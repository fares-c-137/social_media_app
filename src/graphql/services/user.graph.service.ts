import { UserModel } from '../../DB/model/user.model'
import { FilterQuery } from 'mongoose'

type Pagination = { page?: number; limit?: number }
type User = any

function toUser(node: any): User {
  return {
    id: String(node._id),
    name: [node.firstName, node.lastName].filter(Boolean).join(' ') || node.username || '',
    description: node.bio ?? '',
    email: node.email ?? null,
    role: node.role ?? 'user',
    gender: node.gender ?? null
  }
}

export async function getAllUsers(pagination?: Pagination) {
  const page = Math.max(1, Number(pagination?.page || 1))
  const limit = Math.max(1, Math.min(100, Number(pagination?.limit || 20)))
  const skip = (page - 1) * limit

  const [docs, total] = await Promise.all([
    UserModel.find({}).skip(skip).limit(limit),
    UserModel.countDocuments({})
  ])

  return { items: docs.map(toUser), total }
}

type SearchArgs = {
  keyword: string
  field?: 'NAME' | 'EMAIL' | 'ROLE' | 'GENDER'
  role?: 'user' | 'admin'
  gender?: 'male' | 'female'
}

export async function searchOneUser(args: SearchArgs) {
  const { keyword, field, role, gender } = args
  const filter: FilterQuery<any> = {}
  if (role) filter.role = role
  if (gender) filter.gender = gender

  if (field === 'EMAIL') filter.email = new RegExp(keyword, 'i')
  else if (field === 'ROLE') filter.role = keyword
  else if (field === 'GENDER') filter.gender = keyword
  else {
    filter.$or = [
      { firstName: new RegExp(keyword, 'i') },
      { lastName: new RegExp(keyword, 'i') },
      { username: new RegExp(keyword, 'i') }
    ]
  }

  const user = await UserModel.findOne(filter)
  return user ? toUser(user) : null
}

export async function pickAnyUser() {
  const user = await UserModel.findOne({})
  return user ? toUser(user) : null
}

export async function userById(id: string) {
  const user = await UserModel.findById(id)
  return user ? toUser(user) : null
}

export async function updateDescription(id: string, description: string) {
  const user = await UserModel.findByIdAndUpdate(id, { bio: description }, { new: true })
  return user ? toUser(user) : null
}

export async function upsert(args: any) {
  const { id, firstName, lastName, email, role, gender, description } = args
  const update: any = { firstName, lastName, email, role, gender, bio: description }
  const user = id
    ? await UserModel.findByIdAndUpdate(id, update, { new: true, upsert: true })
    : await UserModel.create(update)
  return user ? toUser(user) : null
}
