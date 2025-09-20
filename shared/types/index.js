// ===== SHARED TYPES FOR ADS FINDER PRO =====
// Enums for better type safety
export var AdSource;
(function (AdSource) {
    AdSource["FACEBOOK_API"] = "facebook_api";
    AdSource["APIFY_SCRAPING"] = "apify_scraping";
    AdSource["WEB_SCRAPING"] = "web_scraping";
})(AdSource || (AdSource = {}));
export var SearchMethod;
(function (SearchMethod) {
    SearchMethod["API"] = "api";
    SearchMethod["SCRAPING"] = "scraping";
    SearchMethod["APIFY"] = "apify";
})(SearchMethod || (SearchMethod = {}));
export var AdType;
(function (AdType) {
    AdType["ALL"] = "ALL";
    AdType["POLITICAL"] = "POLITICAL_AND_ISSUE_ADS";
    AdType["FINANCIAL"] = "FINANCIAL_PRODUCTS_AND_SERVICES_ADS";
    AdType["EMPLOYMENT"] = "EMPLOYMENT_ADS";
    AdType["HOUSING"] = "HOUSING_ADS";
})(AdType || (AdType = {}));
export var MediaType;
(function (MediaType) {
    MediaType["ALL"] = "ALL";
    MediaType["VIDEO"] = "VIDEO";
    MediaType["IMAGE"] = "IMAGE";
    MediaType["MEME"] = "MEME";
    MediaType["NONE"] = "NONE";
})(MediaType || (MediaType = {}));
export var Country;
(function (Country) {
    Country["ALL"] = "ALL";
    Country["US"] = "US";
    Country["CO"] = "CO";
    Country["BR"] = "BR";
    Country["MX"] = "MX";
    Country["AR"] = "AR";
    Country["ES"] = "ES";
    // Add more as needed
})(Country || (Country = {}));
//# sourceMappingURL=index.js.map