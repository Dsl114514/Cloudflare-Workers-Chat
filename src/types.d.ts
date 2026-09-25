// v1.57 工具链：ambient 声明——Wrangler 把 *.html/*.css/*.svg 作为 Data 模块（字符串 import），tsc 需声明
declare module "*.html" { const s: string; export default s; }
declare module "*.css" { const s: string; export default s; }
declare module "*.svg" { const s: string; export default s; }
