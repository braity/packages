import {
  CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand, AdminGetUserCommand,
  AdminUpdateUserAttributesCommand, ListUsersCommand, AdminSetUserPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';
import {jwtVerify, createRemoteJWKSet} from 'jose';
import {
  AddUserOptions, IAWSCognitoUserPool, UpdateUserFields, CreateUserFields, User, Properties,
  AWSCognitoUserPoolForUserPoolIdOptions,
} from './aws-cognito-user-pool.types';

export class AwsCognitoUserPool<T extends Properties> implements IAWSCognitoUserPool<T> {
  protected constructor(
    private readonly userPoolId: string,
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly jose: { createRemoteJWKSet: typeof createRemoteJWKSet, jwtVerify: typeof jwtVerify },
  ) {
  }

  static forUserPoolId<T extends Properties>(userPoolId: string, options: AWSCognitoUserPoolForUserPoolIdOptions) {
    return new AwsCognitoUserPool<T>(
      userPoolId,
      new CognitoIdentityProviderClient(options),
      {createRemoteJWKSet, jwtVerify}
    )
  }

  async createUser(properties: CreateUserFields<T>, options?: AddUserOptions): Promise<User<T>> {
    try {
      const {User: user} = await this.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: properties.email,
          TemporaryPassword: properties.password,
          MessageAction: options?.verified ? 'SUPPRESS' : undefined,
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            // map properties to user attributes
            ...(Object
                .entries(properties)
                .filter(([name]) => !['password'].includes(name))
                .map(([Name, Value]) => ({Name, Value}))
            ),
            // always force to use email from parameter
            {Name: 'email', Value: properties.email},
            {Name: 'email_verified', Value: options?.verified ? 'true' : 'false'},
          ],
        })
      )

      return this.formatUser(user)
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async updateUser(id: string, fields: UpdateUserFields<T>): Promise<User<T>> {
    try {
      const userAttributes = Object.entries(fields)
        .filter(where => where[0]?.toLowerCase() !== 'password')
        .map(([Name, Value]) => ({Name, Value}));

      await Promise.all([
        // update attributes
        this.cognito.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: this.userPoolId,
            Username: id,
            UserAttributes: userAttributes
          })
        ),
        // set new passwords if needed
        fields.password ? this.cognito.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: this.userPoolId,
            Username: id,
            Password: fields.password
          })
        ) : Promise.resolve()
      ])

      return this.getUserById(id)
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await this.cognito.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
          Username: id,
        })
      )
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async listUsers(): Promise<User<T>[]> {
    try {
      const users = [];
      let paginationToken = null

      do {
        const {Users, PaginationToken} = await this.cognito.send(
          new ListUsersCommand({
            UserPoolId: this.userPoolId,
            PaginationToken: paginationToken,
            Limit: 60, // maximum available limit
          })
        )

        paginationToken = PaginationToken || null;
        users.push(...Users)
      } while (paginationToken !== null)

      return users.map(user => this.formatUser(user))
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async getUserById(id: string): Promise<User<T>> {
    try {
      const userResponse = await this.cognito.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: id
        })
      )

      return this.formatUser(userResponse)
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async getUserUsingToken(token: string): Promise<User<T>> {
    try {
      const {userPoolId} = this;
      const region = await this.cognito.config.region()
      const JWKSURL = new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`)
      const JWKS = await this.jose.createRemoteJWKSet(JWKSURL)
      const {payload} = await this.jose.jwtVerify(token, JWKS)
      const username = payload?.['token_use'] === 'id'
        ? payload?.['cognito:username'] as string
        : payload?.['username'] as string

      if (!username) {
        throw new Error('cognito:username or username needs to be passed')
      }

      return this.getUserById(username)
    } catch (error) {
      throw new Error(error.message)
    }
  }

  private formatUser(user: any): User<T> {
    const attributes = user.Attributes || user.UserAttributes || []
    const reducedAttributes = attributes
      ?.filter(attr => !['sub'].includes(attr.Name))
      ?.reduce((acc, attribute) => ({...acc, [attribute.Name]: attribute.Value}), {})

    return {
      ...reducedAttributes,
      id: user.Username,
      email: attributes.find(attribute => attribute.Name === 'email')?.Value,
      email_verified: attributes.find(attribute => attribute.Name === 'email_verified')?.Value === 'true',
    } as User<T>
  }
}
