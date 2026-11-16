export const REGISTER_DEVICE_TOKEN = /* GraphQL */ `
  mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input)
  }
`;
export const UNREGISTER_DEVICE_TOKEN = /* GraphQL */ `
  mutation UnregisterDeviceToken($token: String!) {
    unregisterDeviceToken(token: $token)
  }
`;
