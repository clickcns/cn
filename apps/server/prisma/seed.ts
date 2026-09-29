/**
 * 로컬 개발용 시드. 여러 번 실행해도 중복으로 쌓이지 않는다.
 * 시드 계정 비밀번호는 모두 1234이며, 다시 실행하면 1234와 시드 역할·직종으로 되돌린다.
 * 이름·연락처·주소·번호는 가상 데이터다. 내용 정리: docs/seed-data.md
 *
 *   pnpm db:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import {
  addKstDays,
  formatKstDate,
  formDataSchema,
  resolveFormIds,
  FORMS,
  toKstIsoDateTime,
  type FormData,
  type FormId,
  type Profession,
  type Program,
  type Role,
  type VisitForms,
} from "@repo/shared-types";
import * as bcrypt from "bcryptjs";
import dotenv from "dotenv";
import {
  PrismaClient,
  type Prisma,
  type VisitStatus,
} from "../src/generated/prisma/client.js";

dotenv.config({ path: ".env" });

/**
 * 개발 편의용 비밀번호. 시드는 bcrypt 해시를 직접 넣으므로 API의 비밀번호 규칙을 거치지 않는다.
 * 개발 환경은 화면에서도 4자부터 받으므로(allowShortPasswordsForDev) 같은 비밀번호를 쓸 수 있다.
 */
const DEFAULT_PASSWORD = "1234";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface SeedUser {
  username: string;
  name: string;
  role: Role;
  profession?: Profession;
  licenseNumber?: string;
}

async function upsertUser(
  user: SeedUser,
  organizationId: string | null,
  passwordHash: string,
) {
  // 이미 있는 시드 계정도 비밀번호·역할·직종·사용 상태를 되돌려 언제든 로그인할 수 있게 한다.
  const data = {
    name: user.name,
    role: user.role,
    profession: user.profession ?? null,
    licenseNumber: user.licenseNumber ?? null,
    organizationId,
    password: passwordHash,
    isActive: true,
  };
  return prisma.user.upsert({
    where: { username: user.username },
    update: data,
    create: { username: user.username, ...data },
  });
}

async function upsertOrganization(
  code: string,
  name: string,
  programs: Program[],
) {
  return prisma.organization.upsert({
    where: { code },
    update: { programs },
    create: { code, name, programs },
  });
}

/** 수급자는 기관에 한 명도 없을 때만 넣는다. */
async function seedRecipients(
  organizationId: string,
  recipients: Omit<Prisma.RecipientCreateManyInput, "organizationId">[],
) {
  const count = await prisma.recipient.count({ where: { organizationId } });
  if (count === 0) {
    await prisma.recipient.createMany({
      data: recipients.map((recipient) => ({ ...recipient, organizationId })),
    });
  }
  const rows = await prisma.recipient.findMany({ where: { organizationId } });
  return new Map(rows.map((row) => [row.name, row.id]));
}

/** 서식 값은 서식 정의로 검사해 빈 칸을 채운 뒤 넣는다(시드도 API와 같은 모양). */
function form(formId: FormId, data: Record<string, unknown>): FormData {
  return formDataSchema(FORMS[formId]).parse(data);
}

interface SeedVisit {
  recipient: string;
  staff: { id: string; profession: Profession | null };
  program: Program;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  status?: VisitStatus;
  confirmedAt?: Date;
  forms?: VisitForms;
}

/** 방문은 기관에 한 건도 없을 때만 넣는다. 서식은 사업·담당자 직종의 기본값(필수 + 미리 켜 둔 선택 서식)이다. */
async function seedVisits(
  organizationId: string,
  recipients: Map<string, string>,
  visits: SeedVisit[],
) {
  const count = await prisma.visit.count({ where: { organizationId } });
  if (count > 0) return;
  for (const visit of visits) {
    const { profession } = visit.staff;
    if (!profession) throw new Error("방문 담당자는 직종이 있어야 합니다");
    await prisma.visit.create({
      data: {
        organizationId,
        recipientId: recipients.get(visit.recipient)!,
        staffId: visit.staff.id,
        program: visit.program,
        profession,
        formIds: resolveFormIds(visit.program, profession),
        scheduledAt: visit.scheduledAt,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        status: visit.status,
        confirmedAt: visit.confirmedAt,
        forms: {
          create: Object.entries(visit.forms ?? {}).map(([formId, data]) => ({
            formId,
            data: data as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}

const today = formatKstDate();
const yesterday = addKstDays(today, -1);
const at = (date: string, time: string) =>
  new Date(toKstIsoDateTime(date, time));

async function seedLtcNursingCenter(passwordHash: string) {
  const organization = await upsertOrganization(
    "DEMO-001",
    "데모 방문간호센터",
    ["LTC_NURSING"],
  );
  await upsertUser(
    { username: "manager", name: "김관리", role: "MANAGER" },
    organization.id,
    passwordHash,
  );
  const nurse1 = await upsertUser(
    {
      username: "nurse1",
      name: "이간호",
      role: "STAFF",
      profession: "NURSE",
      licenseNumber: "N-100001",
    },
    organization.id,
    passwordHash,
  );
  const nurse2 = await upsertUser(
    {
      username: "nurse2",
      name: "박간호",
      role: "STAFF",
      profession: "NURSE",
      licenseNumber: "N-100002",
    },
    organization.id,
    passwordHash,
  );

  const recipients = await seedRecipients(organization.id, [
    {
      name: "김영자",
      programs: ["LTC_NURSING"],
      birthDate: new Date("1936-04-12T00:00:00Z"),
      gender: "FEMALE",
      careGrade: "2",
      ltcCertNumber: "L0000000101",
      address: "서울시 가상구 예시로 12, 101동 1203호",
      phone: "010-0000-0101",
      guardianName: "김민수(아들)",
      guardianPhone: "010-0000-0102",
      notes: "천골 부위 욕창 관리 중. 혈압약 복용.",
    },
    {
      name: "박순례",
      programs: ["LTC_NURSING"],
      birthDate: new Date("1941-09-03T00:00:00Z"),
      gender: "FEMALE",
      careGrade: "3",
      ltcCertNumber: "L0000000201",
      address: "서울시 가상구 샘플길 45",
      phone: "010-0000-0201",
      guardianName: "정은희(며느리)",
      guardianPhone: "010-0000-0202",
      notes: "당뇨. 인슐린 자가 주사 교육 중.",
    },
    {
      name: "이만수",
      programs: ["LTC_NURSING"],
      birthDate: new Date("1938-01-27T00:00:00Z"),
      gender: "MALE",
      careGrade: "1",
      ltcCertNumber: "L0000000301",
      address: "서울시 가상구 테스트로 7, 2층",
      guardianName: "이지현(딸)",
      guardianPhone: "010-0000-0302",
      notes: "유치도뇨관 사용. 한 달마다 교체.",
    },
    {
      name: "최말순",
      programs: ["LTC_NURSING"],
      birthDate: new Date("1944-06-15T00:00:00Z"),
      gender: "FEMALE",
      careGrade: "4",
      address: "서울시 가상구 연습길 88",
      phone: "010-0000-0401",
    },
    {
      name: "정덕배",
      programs: ["LTC_NURSING"],
      birthDate: new Date("1946-11-30T00:00:00Z"),
      gender: "MALE",
      careGrade: "COGNITIVE",
      address: "서울시 가상구 모의로 3",
      guardianName: "정수아(딸)",
      guardianPhone: "010-0000-0502",
      notes: "경도 인지저하. 보호자 동석 필요.",
    },
  ]);

  const program = "LTC_NURSING";
  await seedVisits(organization.id, recipients, [
    {
      recipient: "김영자",
      staff: nurse1,
      program,
      scheduledAt: at(yesterday, "10:00"),
      startedAt: at(yesterday, "10:05"),
      endedAt: at(yesterday, "10:45"),
      status: "CONFIRMED",
      confirmedAt: at(yesterday, "11:10"),
      forms: {
        LTC_NURSING: form("LTC_NURSING", {
          systolic: 132,
          diastolic: 84,
          pulse: 78,
          temperature: 36.6,
          healthCare: [{ value: "MEDICATION", minutes: 5, note: "복약 확인" }],
          nursingCare: [
            {
              value: "PRESSURE_ULCER",
              minutes: 15,
              note: "천골 3×2cm, 삼출물 소량, 폼 드레싱 교체",
            },
          ],
          specialNote:
            "지난 방문보다 욕창 크기 감소. 식사량 반 공기(보호자 진술).",
          nextPlan: "다음 방문 시 욕창 경과 확인.",
        }),
      },
    },
    {
      recipient: "김영자",
      staff: nurse1,
      program,
      scheduledAt: at(today, "09:30"),
    },
    {
      recipient: "박순례",
      staff: nurse1,
      program,
      scheduledAt: at(today, "11:00"),
    },
    {
      recipient: "이만수",
      staff: nurse1,
      program,
      scheduledAt: at(today, "14:00"),
    },
    {
      recipient: "최말순",
      staff: nurse2,
      program,
      scheduledAt: at(today, "10:00"),
    },
  ]);

  return organization;
}

async function seedHomeCareClinic(passwordHash: string) {
  const organization = await upsertOrganization(
    "DEMO-002",
    "데모 재택의료의원",
    ["PRIMARY_CARE", "HOME_CARE_CENTER"],
  );
  await upsertUser(
    { username: "manager2", name: "한관리", role: "MANAGER" },
    organization.id,
    passwordHash,
  );
  const doctor = await upsertUser(
    {
      username: "doctor1",
      name: "정의사",
      role: "STAFF",
      profession: "DOCTOR",
      licenseNumber: "D-200001",
    },
    organization.id,
    passwordHash,
  );
  const nurse = await upsertUser(
    {
      username: "hnurse1",
      name: "오간호",
      role: "STAFF",
      profession: "NURSE",
      licenseNumber: "N-200002",
    },
    organization.id,
    passwordHash,
  );
  const socialWorker = await upsertUser(
    {
      username: "social1",
      name: "윤복지",
      role: "STAFF",
      profession: "SOCIAL_WORKER",
      licenseNumber: "S-200003",
    },
    organization.id,
    passwordHash,
  );

  const recipients = await seedRecipients(organization.id, [
    {
      name: "강옥자",
      programs: ["HOME_CARE_CENTER"],
      birthDate: new Date("1939-03-02T00:00:00Z"),
      gender: "FEMALE",
      careGrade: "1",
      ltcCertNumber: "L0000001101",
      address: "서울시 가상구 연습로 21, 3층",
      phone: "010-0000-1101",
      guardianName: "강동원(아들)",
      guardianPhone: "010-0000-1102",
      notes: "와상. 유치도뇨관 사용, 천골 욕창 2단계.",
    },
    {
      name: "문태식",
      // 장기요양등급은 있지만 재택의료센터에는 등록하지 않은 환자: 의사 방문은 별지 제4호만 쓴다.
      programs: ["PRIMARY_CARE"],
      birthDate: new Date("1942-08-19T00:00:00Z"),
      gender: "MALE",
      careGrade: "2",
      ltcCertNumber: "L0000001201",
      address: "서울시 가상구 시범길 9",
      guardianName: "문지은(딸)",
      guardianPhone: "010-0000-1202",
      notes: "뇌경색 후 좌측 편마비. 연하곤란.",
    },
    {
      name: "서금순",
      programs: ["HOME_CARE_CENTER"],
      birthDate: new Date("1945-12-05T00:00:00Z"),
      gender: "FEMALE",
      careGrade: "3",
      ltcCertNumber: "L0000001301",
      address: "서울시 가상구 모의로 55",
      phone: "010-0000-1301",
      guardianName: "서민호(아들)",
      guardianPhone: "010-0000-1302",
      notes: "초기 치매. 혼자 거주.",
    },
  ]);

  // 어제 확정한 의사 방문: 오늘 방문의 이월 값(대상자 구분·거동불편 유형·이동 정보 등)이 여기서 온다.
  const doctorYesterday = {
    PRIMARY_CARE_CHECK: form("PRIMARY_CARE_CHECK", {
      ltcGrade: { value: "GRADE_1" },
      bedridden: { value: "YES" },
      sameBuilding: { value: "NONE" },
      copayment: { value: "PARTIAL" },
      mobility: [{ value: "DEVICE" }, { value: "PRESSURE_ULCER" }],
      frequencyException: [{ value: "NONE" }],
      appointment: { value: "SCHEDULED" },
      companion: [{ value: "NURSE" }],
      transport: { value: "OWN_VEHICLE" },
      distanceKm: 3,
      travelTime: { value: "FROM_10_TO_20" },
      visitReason: [
        { value: "DEVICE", detail: "유치도뇨관" },
        { value: "PRESSURE_ULCER" },
      ],
      treatment: [{ value: "INVASIVE" }, { value: "CONSULT" }],
      plan: { value: "REVISIT" },
      communityLink: { value: "NOT_LINKED" },
    }),
    HOME_CARE_DOCTOR: form("HOME_CARE_DOCTOR", {
      companion: [{ value: "NURSE" }],
      visitReason: { value: "REGULAR" },
      physicalTrend: { value: "MAINTAINED" },
      physicalLevel: { value: "INDOOR_FULL_HELP" },
      cognitiveTrend: { value: "MAINTAINED" },
      cognitiveLevel: { value: "WEEKLY_1_2" },
      consultation: [{ value: "DISEASE" }, { value: "PRESSURE_ULCER" }],
      invasive: "유치도뇨관 교체",
      nursingOrders: [{ value: "TUBE" }, { value: "PRESSURE_ULCER" }],
      plan: { value: "CONTINUE" },
      summary: "욕창 2단계 유지. 도뇨관 교체 후 소변 배출 양호함.",
    }),
  };

  await seedVisits(organization.id, recipients, [
    {
      recipient: "강옥자",
      staff: doctor,
      program: "HOME_CARE_CENTER",
      scheduledAt: at(yesterday, "10:00"),
      startedAt: at(yesterday, "10:10"),
      endedAt: at(yesterday, "10:40"),
      status: "CONFIRMED",
      confirmedAt: at(yesterday, "11:00"),
      forms: doctorYesterday,
    },
    {
      recipient: "강옥자",
      staff: doctor,
      program: "HOME_CARE_CENTER",
      scheduledAt: at(today, "09:30"),
    },
    {
      recipient: "문태식",
      staff: doctor,
      program: "PRIMARY_CARE",
      scheduledAt: at(today, "11:00"),
    },
    {
      recipient: "강옥자",
      staff: nurse,
      program: "HOME_CARE_CENTER",
      scheduledAt: at(today, "14:00"),
    },
    {
      recipient: "서금순",
      staff: socialWorker,
      program: "HOME_CARE_CENTER",
      scheduledAt: at(today, "15:00"),
    },
  ]);

  return organization;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await upsertUser(
    { username: "admin", name: "운영자", role: "ADMIN" },
    null,
    passwordHash,
  );
  const ltc = await seedLtcNursingCenter(passwordHash);
  const clinic = await seedHomeCareClinic(passwordHash);

  console.log(`시드 완료 — 비밀번호 모두 ${DEFAULT_PASSWORD}`);
  console.log("  운영자: admin");
  console.log(`  ${ltc.name}: manager(기관 관리자), nurse1·nurse2(간호사)`);
  console.log(
    `  ${clinic.name}: manager2(기관 관리자), doctor1(의사), hnurse1(간호사), social1(사회복지사)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
