import type { Request , Response } from "express"
import type { IconfirmEmailBodyINputDto, IsignupBodyINputDto ,ILoginBodyINputDto, IGmail, IForgotcodeBodyINputDto,IVerifycodeBodyINputDto, IResetcodeBodyINputDto} from "./authentication.dto";
import { UserModel } from "../../DB/model/user.model";
import { UserRepository } from "../../DB/repository/user.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../utils/response/error.response";
import { comparePasswordHash, hashPassword } from "../../utils/security/hash.security";
import { emailEvent } from "../../utils/event/email.event";
import { generateOtpCode } from "../../utils/otp";
import { createLoginCredentials } from "../../utils/security/token.security";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { ProviderEnum } from "../../DB/model/user.model";

class AuthenticationService{
 
    private userRepository = new UserRepository(UserModel)
    constructor  () {}

private async verifyGmailAccount(idToken:string):Promise<TokenPayload> {

const oauthClient = new OAuth2Client();

  const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience:process.env.WEP_CLIENT_IDS?.split(",") || [], 
  });
  const payload = ticket.getPayload();

if (!payload?.email_verified) {
 throw new BadRequestException("Fail to verify account") 
}
return payload
}

loginWithGmail = async(req : Request , res: Response):Promise<Response> => {
  const {idToken}:IGmail=req.body;
  const {email}=  await this.verifyGmailAccount(idToken)
  const userAccount = await this.userRepository.findOne({
    filter :{
      email,
      provider: ProviderEnum.GOOGLE
    },
  })
  
  if (!userAccount) {
   throw new NotFoundException("not register account") 
  }
 

// 2FA check
if ((userAccount as any).twoFAEnabled) {
  const { generateOtpCode } = await import("../../utils/otp");
  const { sendEmail } = await import("../../utils/email/send.email");
  const { verifyEmail } = await import("../../utils/email/verify.template.email");
  const { TwoFAModel } = await import("../../DB/model/twofa.model");
  const otpCode = generateOtpCode();
  const expirationTime = new Date(Date.now() + 10*60*1000);
  await TwoFAModel.create({ userId: userAccount._id, otp: otpCode, expiresAt: expirationTime, type: "login" });
  await sendEmail({ to: userAccount.email, subject: "Your login code", html: verifyEmail({ otp: otpCode, title: "Your login code" }), tags: ["2fa","login"] } as any);
  return res.status(200).json({ message: "2FA required" , data: { twoFA: true } });
}
const loginCredentials = await createLoginCredentials(userAccount)

  return res.json({message: "Done" ,date : {credentials: loginCredentials}})
}

signupWithGmail = async(req : Request , res: Response):Promise<Response> => {
  const {idToken}:IGmail=req.body;
  const {email,family_name,givin_name, picture} = 
  
  await this.verifyGmailAccount(idToken)
  const existingUser = await this.userRepository.findOne({
    filter :{
      email,
    },
  })
  
  if (existingUser) {
   if(existingUser.provider === ProviderEnum.GOOGLE){
      return await this.loginWithGmail(req,res)
   }
   throw new ConflictException(`Email exists with another provider ${existingUser.provider}`) 
  }
const [newUserAccount] = (await this.userRepository.create({
  data:[
    {
      firstName:givin_name  as string,
      lastName : family_name as string,
      email: email as string,
      profileImage: picture  as string,
      confirmedAt : new Date(),
      provider: ProviderEnum.GOOGLE,
    },
  ],
})) || [];
if (!newUserAccount) {
  throw new BadRequestException("Fail to sign up gmail please try again") 
}
 
const loginCredentials = await createLoginCredentials(newUserAccount)

  return res.status(201).json({message: "Done" ,date : {credentials: loginCredentials}})
}

    signup = async (req:Request , res:Response) : Promise<Response> => {

 let {username, email , password}:IsignupBodyINputDto = req.body  
 console.log({username,email , password});


   const existingUserCheck = await this.userRepository.findOne({
    filter : {email},
    select : "email",
   options :{
    lean:false
   }
})
  console.log({existingUserCheck});
  if (existingUserCheck){
    throw new ConflictException(" Email exist ")
  }

  const otpCode = generateOtpCode()

 const newUser = await this.userRepository.createUser({
    data : [{ username,
    email,
    password : await hashPassword(password) ,
    confirmEmailOtp :await hashPassword(String(otpCode) )}] ,

});

emailEvent.emit("confirmEmail" ,{
  to : email ,   otp: otpCode })
 return res.status(201).json({message : " Done ", data : {user: newUser}})
}



   confirmEmail = async( req:Request, res:Response):Promise <Response> => {
    const {email , otp } : IconfirmEmailBodyINputDto=req.body

    const userAccount = await this.userRepository.findOne({
        filter:{
         email ,
         confirmEmailOtp:{$exists:true},
         confirmedAt:{$exists:false}   
        }
    })
   if (!userAccount) {
    throw new NotFoundException ("Invalid Account ")
   }
   if (!await comparePasswordHash(otp ,userAccount.confirmEmailOtp as string)) {
    throw new ConflictException ("innalid confirm")
   }
      await this.userRepository.updateOne({
        filter: {email},
        update:{
            confirmedAt : new Date(),
            $unset:{confirmEmailOtp: 1}
        }
      })

    return res.json({message : " Done "})
}



   login = async( req:Request, res:Response) :Promise<Response> => {
    const {email ,password  }: ILoginBodyINputDto = req.body;
    const userAccount= await this.userRepository.findOne({
      filter:{email , provider:ProviderEnum.SYSTEM }
    })
    if (!userAccount) {
      throw new NotFoundException("Invalid login data")
    }
    if (!userAccount.confirmedAt) {
      throw new BadRequestException("Verify your account first")
    }
    if (!(await comparePasswordHash(password, userAccount.password))) {
      throw new NotFoundException("Invalid login data")
    }
   
    
// 2FA check
if ((userAccount as any).twoFAEnabled) {
  const { generateOtpCode } = await import("../../utils/otp");
  const { sendEmail } = await import("../../utils/email/send.email");
  const { verifyEmail } = await import("../../utils/email/verify.template.email");
  const { TwoFAModel } = await import("../../DB/model/twofa.model");
  const otpCode = generateOtpCode();
  const expirationTime = new Date(Date.now() + 10*60*1000);
  await TwoFAModel.create({ userId: userAccount._id, otp: otpCode, expiresAt: expirationTime, type: "login" });
  await sendEmail({ to: userAccount.email, subject: "Your login code", html: verifyEmail({ otp: otpCode, title: "Your login code" }), tags: ["2fa","login"] } as any);
  return res.status(200).json({ message: "2FA required" , data: { twoFA: true } });
}
const loginCredentials = await createLoginCredentials(userAccount);
   
    return res.json({
      message : " Done ",
       data : {credentials: loginCredentials}
      })
}


sendForgotCode =async( req:Request, res:Response) :Promise<Response> => {
    const {email }: IForgotcodeBodyINputDto = req.body;
    const userAccount= await this.userRepository.findOne({
      filter:{email , provider:ProviderEnum.SYSTEM , confirmedAt:{$exists: true}}
    })
    if (!userAccount) {
      throw new NotFoundException("Invalid account")
    }
   

    const otpCode = generateOtpCode();
   const updateResult =  await this.userRepository.updateOne({
      filter : {email} ,
    update: {
      resetPasswordOtp: await hashPassword(String(otpCode))
    }
    
    })
   
if (!updateResult.matchedCount) {
  throw new BadRequestException ("Fail to send reset code")
}
emailEvent.emit("resetPassword " , {to : email , otp: otpCode})
    return res.json({
      message : " Done "
      })
}

verifyForgotCode =async( req:Request, res:Response) :Promise<Response> => {
    const {email , otp}: IVerifycodeBodyINputDto = req.body;
    const userAccount= await this.userRepository.findOne({
      filter:{email , 
        provider:ProviderEnum.SYSTEM ,
         confirmedAt:{$exists: true},
         resetPasswordOtp: {$exists : true}
        }
    })
    if (!userAccount) {
      throw new NotFoundException("Invalid account")
    }
    if (!(await comparePasswordHash (otp,userAccount.resetPasswordOtp as string))) {
      throw new ConflictException("Invalid otp")
    }
   

    return res.json({
      message : " Done "
      })
}

resetForgotCode =async( req:Request, res:Response) :Promise<Response> => {
    const {email , otp , password}: IResetcodeBodyINputDto = req.body;
    const userAccount= await this.userRepository.findOne({
      filter:{email , 
        provider:ProviderEnum.SYSTEM ,
         confirmedAt:{$exists: true},
         resetPasswordOtp: {$exists : true}
        }
    })
    if (!userAccount) {
      throw new NotFoundException("Invalid account")
    }
    if (!(await comparePasswordHash (otp,userAccount.resetPasswordOtp as string))) {
      throw new ConflictException("Invalid otp")
    }

    
   const updateResult =  await this.userRepository.updateOne({
      filter : {email} ,
    update: {
      password : await hashPassword(password),
      changeCredentialsTime: new Date(),
    $unset: {resetPasswordOtp:1},
    }
    
    })
   
if (!updateResult.matchedCount) {
  throw new BadRequestException ("Fail to reset code")
}
   
    return res.json({
      message : " Done "
      })
}

verify2FALogin = async (req: Request, res: Response): Promise<Response> => {
  const { email, otp } = req.body as any;
  const userAccount = await this.userRepository["model"].findOne({ email });
  if (!userAccount) throw new NotFoundException("User not found");
  const { TwoFAModel } = await import("../../DB/model/twofa.model");
  const twoFARecord = await TwoFAModel.findOne({ userId: userAccount._id, type: "login" }).sort({ createdAt: -1 });
  if (!twoFARecord) throw new BadRequestException("No pending 2FA");
  if (twoFARecord.expiresAt < new Date()) throw new BadRequestException("OTP expired");
  if (twoFARecord.otp !== otp) throw new BadRequestException("Invalid OTP");
  const loginCredentials = await createLoginCredentials(userAccount);
  await twoFARecord.deleteOne();
  return res.status(200).json({ message: "Done", data: { credentials: loginCredentials } });
}

}

export default new AuthenticationService()

