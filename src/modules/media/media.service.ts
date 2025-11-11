import type { Request, Response } from "express";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { success, entity, entities } from "../../utils/response/success.response";
import { s3, S3_BUCKET } from "../../utils/storage/s3.client";
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AssetModel } from "../../DB/model/asset.model";
import { AssetRepository } from "../../DB/repository/asset.repository";
import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";

class MediaService {
  private mediaRepository = new AssetRepository(AssetModel as any);

  uploadSmall = async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File;
    if (!file) throw new BadRequestException("file is required");

    const fileKey = `${(req as any).user?._id ?? "anonymous"}/${Date.now()}-${basename(file.filename)}`;

    const putCommand = new PutObjectCommand({
      Bucket: S3_BUCKET, Key: fileKey, Body: createReadStream(file.path), ContentType: file.mimetype,
    });

    const uploadResult = await s3.send(putCommand);

    const savedMedia = await this.mediaRepository.create({
      owner: (req as any).user?._id,
      key: fileKey, bucket: S3_BUCKET, mime: file.mimetype, size: file.size, etag: (uploadResult as any).ETag, type: "generic",
    });

    return success(res, 201, entity(savedMedia, "Uploaded"));
  };

  uploadLarge = async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File;
    if (!file) throw new BadRequestException("file is required");

    const fileKey = `${(req as any).user?._id ?? "anonymous"}/large/${Date.now()}-${basename(file.filename)}`;

    const multipartInit = await s3.send(new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET, Key: fileKey, ContentType: file.mimetype,
    }));

    if (!multipartInit.UploadId) throw new BadRequestException("Failed to initiate multipart upload");

    const chunkSize = Math.max(5 * 1024 * 1024, Number(process.env.MULTIPART_MIN_CHUNK ?? 8 * 1024 * 1024));
    const fileSize = statSync(file.path).size;
    const totalParts = Math.ceil(fileSize / chunkSize);

    const completedParts: { ETag?: string; PartNumber: number }[] = [];
    for (let partIndex = 1; partIndex <= totalParts; partIndex++) {
      const startByte = (partIndex - 1) * chunkSize;
      const endByte = Math.min(startByte + chunkSize, fileSize) - 1;
      const partStream = createReadStream(file.path, { start: startByte, end: endByte });
      const partUpload = await s3.send(new UploadPartCommand({ Bucket: S3_BUCKET, Key: fileKey, UploadId: multipartInit.UploadId, PartNumber: partIndex, Body: partStream }));
      completedParts.push({ ETag: partUpload.ETag, PartNumber: partIndex });
    }

    const completionResult = await s3.send(new CompleteMultipartUploadCommand({ Bucket: S3_BUCKET, Key: fileKey, UploadId: multipartInit.UploadId, MultipartUpload: { Parts: completedParts } }));

    const savedMedia = await this.mediaRepository.create({
      owner: (req as any).user?._id, key: fileKey, bucket: S3_BUCKET, mime: file.mimetype, size: file.size, etag: completionResult.ETag, type: "generic",
    });

    return success(res, 201, entity(savedMedia, "Uploaded (multipart)"));
  };

  createPreUploadSignedUrl = async (req: Request, res: Response) => {
    const { key, mime, expiresIn, visibility, type } = (req as any).body;
    const putCommand = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: mime, ACL: visibility === "public" ? "public-read" : undefined as any });
    const signedUrl = await getSignedUrl(s3, putCommand, { expiresIn: Number(expiresIn ?? 900) });
    const draftRecord = await this.mediaRepository.create({ owner: (req as any).user?._id, key, bucket: S3_BUCKET, mime, size: 0, type });
    return success(res, 201, entity({ url: signedUrl, key, bucket: S3_BUCKET, draftId: (draftRecord as any)._id }, "Pre-signed URL created"));
  };

  getAssetStream = async (req: Request, res: Response) => {
    const { key } = (req as any).params;
    const mediaItem = await this.mediaRepository.findByKey(key);
    if (!mediaItem) throw new NotFoundException("Asset not found");
    const s3Object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    res.setHeader("Content-Type", (s3Object as any).ContentType ?? (mediaItem as any).mime);
    if ((s3Object as any).Body) ((s3Object as any).Body as any).pipe(res as any);
  };

  getAssetPresignedUrl = async (req: Request, res: Response) => {
    const { key } = (req as any).params;
    const getCommand = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: Number((req as any).query.expiresIn ?? 900) });
    return success(res, 200, entity({ url: presignedUrl }, "OK"));
  };

  download = async (req: Request, res: Response) => {
    const { key } = (req as any).params;
    const mediaItem = await this.mediaRepository.findByKey(key);
    if (!mediaItem) throw new NotFoundException("Asset not found");
    const s3Object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    res.setHeader("Content-Disposition", `attachment; filename="${basename(key)}"`);
    res.setHeader("Content-Type", (s3Object as any).ContentType ?? (mediaItem as any).mime);
    if ((s3Object as any).Body) ((s3Object as any).Body as any).pipe(res as any);
  };

  deleteFile = async (req: Request, res: Response) => {
    const { key } = (req as any).params;
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const mediaDocument = await this.mediaRepository.findByKey(key);
    if (mediaDocument) await this.mediaRepository.softDeleteById((mediaDocument as any)._id);
    return success(res, 200, entity({ key }, "Deleted (soft)"));
  };

  deleteFiles = async (req: Request, res: Response) => {
    const { keys } = (req as any).body as { keys: string[] };
    if (!keys?.length) throw new BadRequestException("keys[] required");
    await s3.send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
    return success(res, 200, entities(keys.map((k) => ({ key: k })), "Deleted"));
  };

  deleteFolderByPrefix = async (req: Request, res: Response) => {
    const { prefix } = (req as any).params;
    const listResult = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix }));
    const itemsToDelete = ((listResult.Contents ?? []) as any[]).map((c: any) => ({ Key: c.Key }));
    if (itemsToDelete.length) await s3.send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: itemsToDelete } }));
    return success(res, 200, entity({ prefix, deleted: itemsToDelete.length }, "Deleted by prefix"));
  };

  restore = async (req: Request, res: Response) => {
    const { id } = (req as any).params as any;
    const restoredItem = await (new AssetRepository(AssetModel as any)).restoreById(id);
    if (!restoredItem) throw new NotFoundException("Asset not found");
    return success(res, 200, entity(restoredItem, "Restored"));
  };

  hardDelete = async (req: Request, res: Response) => {
    const { id } = (req as any).params as any;
    const mediaDocument = await (new AssetRepository(AssetModel as any)).findById(id);
    if (!mediaDocument) throw new NotFoundException("Asset not found");
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: (mediaDocument as any).key }));
    await (new AssetRepository(AssetModel as any)).hardDeleteById(id);
    return success(res, 200, entity({ id }, "Hard deleted"));
  };

  setProfileImage = async (req: Request, res: Response) => {
    const file = (req as any).file as Express.Multer.File;
    if (!file) throw new BadRequestException("file is required");
    const fileKey = `${(req as any).user?._id}/profile/${Date.now()}-${basename(file.originalname)}`;
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: fileKey, Body: createReadStream(file.path), ContentType: file.mimetype }));
    await this.deleteFolderByPrefixLike(`${(req as any).user?._id}/profile/`);
    const savedMedia = await this.mediaRepository.create({ owner: (req as any).user?._id, key: fileKey, bucket: S3_BUCKET, mime: file.mimetype, size: file.size, type: "profile" });
    return success(res, 201, entity(savedMedia, "Profile image updated"));
  };

  setCoverImages = async (req: Request, res: Response) => {
    const files = (req as any).files as Express.Multer.File[];
    if (!files?.length) throw new BadRequestException("files[] required");
    await this.deleteFolderByPrefixLike(`${(req as any).user?._id}/cover/`);
    const uploadedFiles: any[] = [];
    for (const file of files) {
      const fileKey = `${(req as any).user?._id}/cover/${Date.now()}-${basename(file.originalname)}`;
      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: fileKey, Body: createReadStream(file.path), ContentType: file.mimetype }));
      uploadedFiles.push(await this.mediaRepository.create({ owner: (req as any).user?._id, key: fileKey, bucket: S3_BUCKET, mime: file.mimetype, size: file.size, type: "cover" }));
    }
    return success(res, 201, entities(uploadedFiles, "Cover images updated"));
  };

  private deleteFolderByPrefixLike = async (prefix: string) => {
    const listResult = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix }));
    const itemsToDelete = ((listResult.Contents ?? []) as any[]).map((c: any) => ({ Key: c.Key }));
    if (itemsToDelete.length) await s3.send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: itemsToDelete } }));
  };
}

export default new MediaService();

