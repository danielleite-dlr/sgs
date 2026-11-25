import { gql } from '@apollo/client';

export const MyAccessQuery = gql`
  query MyAccess {
    myAccess {
      memberId
      roleName
      permissions
      canManageAccess
      items {
        id
        label
        group
        groupLabel
        enabled
        defaultEnabled
        source
        adjustable
        lockReason
        permissions
      }
    }
  }
`;

export type AccessSource = 'DEFAULT' | 'GRANTED' | 'DENIED';

export interface AccessItemData {
  id: string;
  label: string;
  group: string;
  groupLabel: string;
  enabled: boolean;
  defaultEnabled: boolean;
  source: AccessSource;
  adjustable: boolean;
  lockReason: string | null;
  permissions: string[];
}

export interface MyAccessData {
  memberId: string;
  roleName: string;
  permissions: string[];
  canManageAccess: boolean;
  items: AccessItemData[];
}

export interface MyAccessResult {
  myAccess: MyAccessData;
}
