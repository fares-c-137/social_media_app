import { Router } from "express";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./media.validation";
import mediaService from "./media.service";
import { singleUpload, multiUpload } from "../../middleware/multer.middleware";
import { authentication } from "../../middleware/authentication.middleware";

const mediaRouter = Router();

mediaRouter.post("/upload/small", authentication, singleUpload("file"), mediaService.uploadSmall);
mediaRouter.post("/upload/large", authentication, singleUpload("file"), mediaService.uploadLarge);
mediaRouter.post("/upload/presign", authentication, validation(validators.createPresignUploadDto), mediaService.createPreUploadSignedUrl);

mediaRouter.get("/asset/stream/:key", authentication, mediaService.getAssetStream);
mediaRouter.get("/asset/url/:key", authentication, mediaService.getAssetPresignedUrl);
mediaRouter.get("/asset/download/:key", authentication, mediaService.download);

mediaRouter.delete("/asset/:key", authentication, mediaService.deleteFile);
mediaRouter.delete("/assets", authentication, validation(validators.deleteManyDto), mediaService.deleteFiles);
mediaRouter.delete("/assets/prefix/:prefix", authentication, mediaService.deleteFolderByPrefix);

mediaRouter.patch("/assets/restore/:id", authentication, mediaService.restore);
mediaRouter.delete("/assets/hard-delete/:id", authentication, mediaService.hardDelete);

mediaRouter.post("/profile", authentication, singleUpload("file"), mediaService.setProfileImage);
mediaRouter.post("/cover", authentication, multiUpload("files", 5), mediaService.setCoverImages);

export default mediaRouter;

