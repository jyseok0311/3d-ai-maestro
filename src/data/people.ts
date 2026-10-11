/** Name pools for the fictional demo data. */

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = [
  '민준', '서연', '도윤', '하은', '지호', '수아', '예준', '지우', '시우', '서윤', '주원', '하린',
  '유진', '지민', '현우', '다은', '건우', '채원', '우진', '소율', '준서', '예린', '도현', '수빈',
];

export const DEPARTMENTS = [
  '학사과', '입학과', '재무과', '연구지원과', '시설과', '국제교류과', '도서관', '총무과',
  '학생지원과', '정보화본부', '기획평가과', '산학협력단',
];
export const TITLES = ['주무관', '주무관', '주임', '주임', '팀장', '연구원', '전문관'];
export const MENTORS = ['김하늘 교수', '이도현 교수', '박서연 책임', '최지훈 책임', '정예린 박사', '강민준 박사'];

/** Study teams are named after orchestra instruments — the maestro conducts them all. */
export const TEAM_NAMES = [
  '바이올린', '첼로', '플루트', '호른', '하프', '팀파니', '오보에', '클라리넷',
  '비올라', '트럼펫', '바순', '튜바', '피아노', '트롬본', '콘트라베이스', '실로폰',
];

export const TOPICS = [
  '회의록 자동 요약 봇', '민원 FAQ 챗봇', '예산 집행 분석 대시보드', '공문 초안 생성기',
  '학사 일정 알림 자동화', '연구비 정산 체크리스트 AI', '시설 점검 사진 분류', '국제교류 메일 번역 도우미',
  '입시 상담 Q&A 정리', '도서 추천 에이전트', '출장 정산 자동화', '규정 검색 어시스턴트',
];

export function makeName(rand: () => number): string {
  return SURNAMES[Math.floor(rand() * SURNAMES.length)] + GIVEN[Math.floor(rand() * GIVEN.length)];
}
