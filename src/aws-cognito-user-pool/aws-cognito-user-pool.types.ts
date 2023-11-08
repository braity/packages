export type User<T extends object> = { id: string, email: string, email_verified: boolean } & T
export type CreateUserFields<T extends object> = { email?: string, password?: string } & T
export type UpdateUserFields<T extends object> = Omit<CreateUserFields<T>, 'email'>
export type AddUserOptions = { verified?: boolean }
export type Properties = { [key in string]: string }

export type AWSCognitoUserPoolForUserPoolIdOptions = {
  region: string,
  credentials: {
    accessKeyId: string,
    secretAccessKey: string
  }
}

export interface IAWSCognitoUserPool<T extends Properties> {
  createUser(properties?: CreateUserFields<T>, options?: AddUserOptions): Promise<User<T>>

  updateUser(id: string, fields: UpdateUserFields<T>): Promise<User<T>>

  deleteUser(id: string): Promise<void>

  listUsers(): Promise<User<T>[]>

  getUserById(id: string): Promise<User<T>>

  getUserUsingToken(token: string): Promise<User<T>>
}
