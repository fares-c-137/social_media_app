import { GraphQLError } from 'graphql'
import * as svc from '../services/user.graph.service'

export const Query = {
  users: async (_: any, args: any) => {
    try {
      const { pagination } = args || {}
      const { items, total } = await svc.getAllUsers(pagination)
      return {
        meta: { success: true, message: 'OK' },
        total,
        items
      }
    } catch (err: any) {
      throw new GraphQLError('FAILED_TO_FETCH_USERS', { originalError: err })
    }
  },

  searchUser: async (_: any, args: any) => {
    try {
      const { args: a } = args || {}
      const item = await svc.searchOneUser(a)
      return {
        meta: { success: !!item, message: item ? 'Found' : 'Not Found' },
        item
      }
    } catch (err: any) {
      throw new GraphQLError('FAILED_TO_SEARCH_USER', { originalError: err })
    }
  },

  demoUserSelection: async () => {
 
    const item = await svc.pickAnyUser()
    return {
      meta: { success: !!item, message: item ? 'OK' : 'No data' },
      item
    }
  },

  userById: async (_: any, { id }: { id: string }) => {
    try {
      const item = await svc.userById(id)
      return {
        meta: { success: !!item, message: item ? 'OK' : 'Not Found' },
        item
      }
    } catch (err: any) {
      throw new GraphQLError('FAILED_TO_GET_USER', { originalError: err })
    }
  }
}

export const Mutation = {
  updateUserDescription: async (_: any, { id, description }: { id: string, description: string }) => {
    try {
      const item = await svc.updateDescription(id, description)
      return {
        meta: { success: !!item, message: item ? 'Updated' : 'Not Found' },
        item
      }
    } catch (err: any) {
      throw new GraphQLError('FAILED_TO_UPDATE_USER', { originalError: err })
    }
  },

  upsertUser: async (_: any, args: any) => {
    try {
      const item = await svc.upsert(args)
      return {
        meta: { success: !!item, message: 'Upserted' },
        item
      }
    } catch (err: any) {
      throw new GraphQLError('FAILED_TO_UPSERT_USER', { originalError: err })
    }
  }
}
