import * as validators from "./authentication.validation"
import { validation } from "../../middleware/validation.middleware";
import authenticationService from './authentication.service'
import { Router } from "express";


const authenticationRouter = Router ()

authenticationRouter.post("/signup" ,validation(validators.signup),authenticationService.signup);
authenticationRouter.post("/signup-gmail" , validation(validators.signupWithGmail),authenticationService.signupWithGmail)
authenticationRouter.post("/login-gmail" , validation(validators.signupWithGmail),authenticationService.loginWithGmail)
authenticationRouter.patch("/confirm-email" ,validation(validators.confirmEmail),authenticationService.confirmEmail)
authenticationRouter.post("/login" ,validation(validators.login),authenticationService.login);
authenticationRouter.post("/verify-2fa-login" ,validation(validators.verify2faLogin),authenticationService.verify2FALogin);

authenticationRouter.patch("/send-reset-password" ,validation(validators.sendForgotPasswordCode),authenticationService.sendForgotCode)
authenticationRouter.patch("/verify-forget-password" ,validation(validators.verifyForgotPassword),authenticationService.verifyForgotCode)
authenticationRouter.patch("/reset-forget-password" ,validation(validators.resetForgotPassword),authenticationService.resetForgotCode)
export default authenticationRouter;

