const QUESTION_CATEGORY_GROUP_BY_UNIT = {
  "地形": "系統地理（自然）",
  "気候": "系統地理（自然）",
  "農業": "系統地理（人文）",
  "工業": "系統地理（人文）",
  "資源・エネルギー": "系統地理（人文）",
  "人口・都市": "系統地理（人文）",
  "交通・通信・貿易": "系統地理（人文）",
  "国家・民族・宗教": "系統地理（人文）",
  "地誌": "地誌",
  "地図問題": "地図"
};

const QUESTION_BANK = (window.GEOGRAPHY_QUESTION_SETS || [])
  .flatMap(set => set.questions || []);

QUESTION_BANK.forEach(question => {
  question.category = question.category || question.unit;
  question.categoryGroup = question.categoryGroup || QUESTION_CATEGORY_GROUP_BY_UNIT[question.unit] || "未分類";
  question.reviewPoint = question.reviewPoint || question.hint;
});
