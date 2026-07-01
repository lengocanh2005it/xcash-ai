jest.mock('@paypilot/shared-types', () => ({
  Role: {
    CAS_PARTNER: 'cas_partner',
    ADMIN: 'admin',
    ACCOUNTANT: 'accountant',
    VIEWER: 'viewer',
  },
}));
