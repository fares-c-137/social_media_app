//ENV
import {resolve} from 'node:path'
import { config } from 'dotenv'
config({path:resolve("./config/.env.development")})
//EXPRESS
import  type  { Express, Request, Response } from 'express'
import express  from 'express'
//LOG
import {log } from 'node:console'
//THIRD MIDDLEWARE
import cors from 'cors'
import helmet from 'helmet'
import {rateLimit} from 'express-rate-limit'
// --- GraphQL ---
import { createHandler } from 'graphql-http/lib/use/express'
import { buildSchema as buildGraphqlSchema } from './graphql/index'


//MODULE ROUTING
import mediaController from "./modules/media/media.controller"
import authenticationController from "./modules/authentication/authentication.controller"
import userManagementController from "./modules/user/user.controller"
import { globalErrorHandler } from './utils/response/error.response'
import establishDatabaseConnection from './DB/database.connector'


 const requestLimiter = rateLimit({
    windowMs:60 * 60000,
    limit:2000,
    message:{error:"Too many request please try again"},
    statusCode : 429
   })

const initializeServer = async (): Promise<void> =>{
  const application : Express = express()
  const serverPort : number| String = process.env.PORT || 5000;
   
    application.use(cors() ,express.json() , helmet() , requestLimiter)
   
    //app routing
   application.get("/" ,(req:Request,res:Response) => {
        res.json({message : `welcome to ${process.env.APPLICATION_NAME} backend landeng page` })
    })
   
    //modules
   
   application.use("/auth", authenticationController)
   application.use("/user", userManagementController)
   application.use("/assets", mediaController);
   application.use("{/*dummy}",(req:Request, res:Response)=>{
    return res.status(404).json({message : "In-valid application routing please check the method and url"})
    })


    // GraphQL route using graphql-http
    try {
      const graphqlSchema = buildGraphqlSchema()
      application.all('/graphql', createHandler({ schema: graphqlSchema }))
    } catch (e) {
      log('GraphQL schema failed to load', e)
    }

   // Post routes
   application.use('/post', (await import('./modules/post/post.controller')).default)

   application.use(globalErrorHandler)

   await establishDatabaseConnection()
   
   application.listen(serverPort, () =>{
        log(`server is running on port ::: ${serverPort}`)

    } )
}
export default initializeServer

