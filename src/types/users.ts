export type UserRole = 
  | "ADMIN"
  | "FINANCE"
  | "TECHNICAL"
  | "SALES"
  | "MARKETING"
  | "DEVELOPER"
  | "ACCOUNT_HOLDER"
  | "READ_ONLY"
  | "APP_MANAGER"
  | "ACCESS_TO_REPORTS"
  | "CUSTOMER_SUPPORT";

export interface User {
  id: string;
  type: string;
  attributes: {
    username: string;
    firstName: string;
    lastName: string;
    roles: UserRole[];
    allAppsVisible?: boolean;
    provisioningAllowed?: boolean;
  };
}

export interface ListUsersResponse {
  data: User[];
}

export interface UserFilters {
  username?: string;
  roles?: UserRole[];
  visibleApps?: string[];
}

export type UserSortOptions = 
  | "username" | "-username"
  | "firstName" | "-firstName"
  | "lastName" | "-lastName"
  | "roles" | "-roles";

export type UserIncludeOptions = "visibleApps";