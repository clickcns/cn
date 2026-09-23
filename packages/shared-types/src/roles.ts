/*
 * 역할(권한)과 직종은 따로 둔다.
 * - 역할: 무엇을 관리할 수 있나(운영자·기관 관리자·현장 직원)
 * - 직종: 방문 때 어떤 서식을 쓰나(의사·간호사·사회복지사). 기관 관리자도 직종이 있으면 직접 방문한다.
 */

export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "운영자",
  MANAGER: "기관 관리자",
  STAFF: "현장 직원",
};

export const PROFESSIONS = ["DOCTOR", "NURSE", "SOCIAL_WORKER"] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const PROFESSION_LABELS: Record<Profession, string> = {
  DOCTOR: "의사",
  NURSE: "간호사",
  SOCIAL_WORKER: "사회복지사",
};

/** 서식에 적는 면허·자격번호 이름. */
export const LICENSE_LABELS: Record<Profession, string> = {
  DOCTOR: "의사 면허번호",
  NURSE: "간호사 면허번호",
  SOCIAL_WORKER: "사회복지사 자격번호",
};

/** 운영자가 아닌 계정은 반드시 기관에 속한다. */
export function requiresOrganization(role: Role): boolean {
  return role !== "ADMIN";
}

/** 현장 직원은 직종이 있어야 한다(방문 서식이 직종으로 정해진다). */
export function requiresProfession(role: Role): boolean {
  return role === "STAFF";
}

/** 운영자는 직종을 갖지 않는다. */
export function allowsProfession(role: Role): boolean {
  return role !== "ADMIN";
}

/** 방문을 맡을 수 있는 사용자: 운영자가 아니고 직종이 있다. */
export function canBeAssignedVisits(user: {
  role: Role;
  profession: Profession | null;
}): boolean {
  return user.role !== "ADMIN" && user.profession !== null;
}

/** 이 역할의 사용자가 만들거나 부여할 수 있는 역할. 운영자 역할은 운영자만 준다. */
export function assignableRoles(actorRole: Role): readonly Role[] {
  return actorRole === "ADMIN"
    ? ROLES
    : ROLES.filter((role) => role !== "ADMIN");
}

/** 로그인하는 앱. 서버가 세션을 만들기 전에 역할을 확인한다. */
export const LOGIN_CLIENTS = ["FIELD_WEB", "ADMIN_WEB"] as const;
export type LoginClient = (typeof LOGIN_CLIENTS)[number];

export const LOGIN_CLIENT_ROLES: Record<LoginClient, readonly Role[]> = {
  FIELD_WEB: ["STAFF", "MANAGER"],
  ADMIN_WEB: ["ADMIN", "MANAGER"],
};

export const LOGIN_CLIENT_DENIED_MESSAGES: Record<LoginClient, string> = {
  FIELD_WEB: "현장 웹은 현장 직원·기관 관리자 계정만 사용할 수 있습니다",
  ADMIN_WEB: "관리 웹은 운영자·기관 관리자 계정만 사용할 수 있습니다",
};

export function canUseClient(role: Role, client: LoginClient): boolean {
  return LOGIN_CLIENT_ROLES[client].includes(role);
}

/** 방문 담당자 표시: "정의사 (의사)". 직종이 없으면 이름만. */
export function staffDisplayName(staff: {
  name: string;
  profession: Profession | null;
}): string {
  return staff.profession
    ? `${staff.name} (${PROFESSION_LABELS[staff.profession]})`
    : staff.name;
}
