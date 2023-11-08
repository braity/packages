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

/**
 * @template T
 * AWS Cognito UserPool wrapper.
 * You can use generic type to define additional user attributes.
 */
export interface IAWSCognitoUserPool<T extends Properties> {

  /**
   * Creates a new user in AWS Cognito User Pool
   * @param {CreateUserFields<T>|{object}} properties user properties
   * @param {string} properties.email user email
   * @param {string} properties.password user temporary password
   * @param {AddUserOptions|object} [options] options
   * @param {boolean} [options.verified] sets user verified and doesn't send email with password
   * @returns {Promise<User<T>>} user data
   */
  createUser(properties?: CreateUserFields<T>, options?: AddUserOptions): Promise<User<T>>

  /**
   * Updates user
   * @param {string} id identifier (username) from Cognito
   * @param {UpdateUserFields<T>|object} fields fields to update
   * @param {string} [fields.password] password to update. User needs to change it after log in.
   * @returns {Promise<User<T>>}} user data
   */
  updateUser(id: string, fields: UpdateUserFields<T>): Promise<User<T>>

  /**
   * @param {string} id identifier (username) from Cognito
   * @returns {Promise<void>}
   */
  deleteUser(id: string): Promise<void>

  /**
   * Returns a list of all users
   * @returns {Promise<User<T>[]>} list of users
   */
  listUsers(): Promise<User<T>[]>

  /**
   * Gets user by identifier (username)
   * @param {string} id identifier (username) from Cognito
   * @returns {Promise<User<T>>} user data
   */
  getUserById(id: string): Promise<User<T>>

  /**
   * @param {string} token
   * @returns {Promise<User<T>>} user data
   */
  getUserUsingToken(token: string): Promise<User<T>>
}
