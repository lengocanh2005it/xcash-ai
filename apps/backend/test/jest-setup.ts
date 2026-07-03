jest.mock('@klassi/shared-types', () => ({
  Role: {
    CAS_PARTNER: 'cas_partner',
    ADMIN: 'admin',
    ACCOUNTANT: 'accountant',
    VIEWER: 'viewer',
  },
}));
