
import {connect} from "mongoose"
import { UserModel } from "./model/user.model";

const establishDatabaseConnection = async () : Promise<void>=> {

    try {
        const connectionResult = await connect(process.env.DB_URI as string ,{
         serverSelectionTimeoutMS:30000,
        })
       await UserModel.syncIndexes()
        console.log(connectionResult.models);
        console.log(" DB connected Succrssfuly ");
        
        
    } catch (error) {
        console.log(` Fail to connect on DB `);
        
    }
}
export default establishDatabaseConnection

