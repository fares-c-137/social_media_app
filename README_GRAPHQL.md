# GraphQL Module

## Why GraphQL vs REST (performance quick notes)
- **Fewer round trips:** Request multiple resources/fields in one HTTP call.
- **Avoid over/under-fetching:** Ask exactly for `name` and `description` (both **Non-Null** in this schema).
- **Caching and batching:** With dataloaders and persisted queries, GraphQL can perform competitively with REST; raw throughput may favor REST for very simple endpoints, but GraphQL shines with complex nested data.

## Run
- Install deps: `npm i graphql graphql-http @graphql-tools/schema`
- Start server: `npm run dev` (or your existing start script)
- Open: `POST /graphql`

## Example Query – Multiple fields + Aliases in the same request
```graphql
query Demo {
  a: demoUserSelection { meta { success } item { id name description } }
  b: userById(id: "USER_ID_HERE") { item { name description email } }
  c: users(pagination: { page: 1, limit: 5 }) {
    total
    items { name description }
  }
}
```

## Enums & Args (required/optional)
```graphql
query Search($kw: String!) {
  searchUser(args: { keyword: $kw, field: NAME, role: user }) {
    meta { success message }
    item { id name email role }
  }
}
```

## Mutations vs Queries
- **Query**: read-only.
- **Mutation**: state change (create/update/delete).
```graphql
mutation Update($id: ID!, $d: String!) {
  updateUserDescription(id: $id, description: $d) {
    meta { success message }
    item { id name description }
  }
}
```

## Error Handling
- We throw `GraphQLError` with clear codes (e.g., `FAILED_TO_FETCH_USERS`). The HTTP status is 200 by spec; inspect `errors` array in the GraphQL response.

## Uniform Response
- Responses include `meta` for consistency across queries/mutations. You can remove it if you prefer bare objects.
```
