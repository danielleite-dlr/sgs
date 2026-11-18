import { gql } from '@apollo/client';

export interface IntakeUserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface IntakeMember {
  id: string;
  displayName: string;
  roleName: string;
}

export interface ImportRow {
  line: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  kind: string | null;
  eventDate: string | null;
  source: string;
  notes: string | null;
  duplicateOf: { type: string; id: string; name: string } | null;
  assigneeRef: string | null;
  assignee: IntakeMember | null;
  assigneeWarning: string | null;
}

export interface ImportPreview {
  totalRows: number;
  valid: ImportRow[];
  invalid: { line: number; reason: string }[];
  errors: IntakeUserError[];
}

export interface ImportResult {
  createdLeads: number;
  createdDeals: number;
  linkedClients: number;
  assignedDeals: number;
  unassignedDeals: number;
  skipped: number;
  errors: IntakeUserError[];
}

export interface FormSettings {
  isActive: boolean;
  token: string;
  publicPath: string;
  defaultAssignee: { id: string; displayName: string } | null;
  successMessage: string | null;
  consentText: string;
  consentTextVersion: string;
}

export const PreviewCommercialLeadImportMutation = gql`
  mutation PreviewCommercialLeadImport($base64: String!, $filename: String!) {
    previewCommercialLeadImport(base64: $base64, filename: $filename) {
      totalRows
      valid {
        line
        fullName
        phone
        email
        kind
        eventDate
        source
        notes
        duplicateOf {
          type
          id
          name
        }
        assigneeRef
        assignee {
          id
          displayName
          roleName
        }
        assigneeWarning
      }
      invalid {
        line
        reason
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ImportCommercialLeadsMutation = gql`
  mutation ImportCommercialLeads($base64: String!, $filename: String!) {
    importCommercialLeads(base64: $base64, filename: $filename) {
      createdLeads
      createdDeals
      linkedClients
      assignedDeals
      unassignedDeals
      skipped
      errors {
        code
        message
        field
      }
    }
  }
`;

const FORM_SETTINGS_FIELDS = gql`
  fragment CommercialFormSettingsFields on CommercialFormSettings {
    isActive
    token
    publicPath
    defaultAssignee {
      id
      displayName
    }
    successMessage
    consentText
    consentTextVersion
  }
`;

export const CommercialFormSettingsQuery = gql`
  query CommercialFormSettings {
    commercialFormSettings {
      ...CommercialFormSettingsFields
    }
  }
  ${FORM_SETTINGS_FIELDS}
`;

export const UpdateCommercialFormSettingsMutation = gql`
  mutation UpdateCommercialFormSettings($input: UpdateCommercialFormSettingsInput!) {
    updateCommercialFormSettings(input: $input) {
      settings {
        ...CommercialFormSettingsFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${FORM_SETTINGS_FIELDS}
`;

export const RegenerateCommercialFormTokenMutation = gql`
  mutation RegenerateCommercialFormToken {
    regenerateCommercialFormToken {
      settings {
        ...CommercialFormSettingsFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${FORM_SETTINGS_FIELDS}
`;

/** Responsável padrão do formulário (a importação não tem seletor: D-22). */
export const CommercialAssigneesForIntakeQuery = gql`
  query CommercialAssigneesForIntake {
    commercialAssignees {
      id
      displayName
      roleName
    }
  }
`;
