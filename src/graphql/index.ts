import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { GraphQLError, GraphQLSchema } from 'graphql'
import * as userResolvers from './resolvers/user.resolver'


const sdl = [
  readFileSync(join(__dirname, './schema.gql'), 'utf-8'),
  readFileSync(join(__dirname, './user.schema.gql'), 'utf-8')
]


const resolvers = {
  Query: {
    ...userResolvers.Query
  },
  Mutation: {
    ...userResolvers.Mutation
  }
}

export function buildSchema(): GraphQLSchema {
  try {
    return makeExecutableSchema({
      typeDefs: sdl,
      resolvers
    })
  } catch (err: any) {
    throw new GraphQLError('Schema build failed', { originalError: err })
  }
}
