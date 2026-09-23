import { z } from "zod";

/**
 * zod 기본 오류 문구를 한국어로 맞춘다(스키마에 적어 둔 문구가 우선).
 * 이 패키지를 불러오는 서버·웹 모두에 한 번만 적용된다.
 */
z.config(z.locales.ko());
