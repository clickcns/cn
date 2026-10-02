import type { TourStep } from "@/components/ui/tour";

/** 수가 관리 [사용 안내] 둘러보기. 넣기·지우기 단계는 운영자만 본다. */
export function feeScheduleTourSteps(isAdmin: boolean): TourStep[] {
  return [
    {
      target: '[data-tour="fee-current"]',
      title: "이번 달에 쓰는 수가",
      body: `재택의료 수입이 이번 달 금액을 셀 때 쓰는 값과 근거(지침 판·쪽)입니다. 다음 달부터 바뀌는 수가를 넣어 두었으면 근거 줄 끝에 "(예정)"이 붙습니다.${isAdmin ? "" : " 수가는 운영자만 넣고 지웁니다."}`,
    },
    ...(isAdmin
      ? [
          {
            target: '[data-tour="fee-new"]',
            title: "지침이 바뀌면 새 수가 넣기",
            body: "시행 월(지침이 적용되는 첫 달)을 고르면 그 전 달 수가가 채워져 있어 바뀐 칸만 고치면 됩니다. 고친 칸은 이전 값과 함께 파랗게 보이고, 근거(지침 판·쪽)는 꼭 적습니다. 다음 달 수가를 미리 넣어 두어도 됩니다.",
            side: "left" as const,
          },
        ]
      : []),
    {
      target: '[data-tour="fee-history"]',
      title: "이력",
      body: "넣은 수가가 시행 월 늦은 순으로 쌓입니다. 줄을 누르면 값과 바로 전 수가에서 바뀐 칸을 봅니다. 지난달 금액은 그때 수가로 셉니다. 고치거나 지운 수가는 [고치거나 지운 이력 보기]를 체크하면 보입니다.",
      side: "top",
    },
    ...(isAdmin
      ? [
          {
            target: ['[data-tour="fee-edit"]', '[data-tour="fee-history"]'],
            title: "잘못 넣었을 때",
            body: `[고치기]로 시행 월·값·근거를 고칩니다. 고치기 전 값은 이력에 "고침"으로 남고, 그 달부터 고친 값으로 다시 셉니다. 필요 없는 수가는 휴지통으로 지웁니다(바로 앞 수가로 돌아가고 이력에 "지움"으로 남습니다).`,
            side: "left" as const,
          },
        ]
      : []),
    {
      target: '[data-tour="fee-default"]',
      title: "코드 기본값",
      body: "넣은 수가가 없는 달은 2026년 지침 값으로 셉니다. 지난달 금액이 바뀌지 않도록 이 값은 그대로 두고, 바뀐 수가는 늘 새로 넣습니다.",
      side: "top",
    },
    {
      target: 'nav a[href$="/home-care"]',
      title: "넣은 뒤 확인",
      body: `재택의료 수입 화면 아래에 그 달에 쓴 수가와 근거가 나옵니다. 방문진료료 단가는 기관 종별(의원·병원급 이상)로 정해집니다${isAdmin ? " — [기관]에서 기관마다 고릅니다." : "(운영자가 정합니다)."}`,
      side: "right",
    },
    {
      target: '[data-tour="fee-doc"]',
      title: "지침 받는 곳",
      body: "지침을 어디서 받는지, 값마다 지침 몇 쪽을 보는지는 수가 근거 문서에 있습니다.",
    },
  ];
}
