# SinD 数据获取记录

核查日期：2026-10-02。官方仓库为 https://github.com/SOTIF-AVLab/SinD ，本次固定版本 `930e4dea78d924c6e9a58ff8e378331f93bba8ec`。

官方 README 的 Dataset Access 说明完整数据需使用教育邮箱申请；GitHub DATASETS.md 明确仓库仅包含公开 CSV 样例。GitHub Releases 本次查询没有完整数据附件。Issue #16 是第三方建议迁移至 Hugging Face，并不是已经发布的下载入口，不据此构造或声称存在可用完整数据链接。

现有天津样例在 `data/sind`；新增公开长春、重庆、西安样例在 `data/sind-public/Data`。新增内容包括机动车/行人轨迹、信号 CSV 和各城市 OSM。地图坐标和信号语义需单独核查，不能把异地轨迹直接放到天津首页道路上。

下载：`python scripts/download-sind-public.py`。Git LFS 文件按 1 MiB 分块续传并验证官方 pointer 中的 SHA256；普通文件验证 Git blob SHA1，并记录 SHA256。校验通过后才保存为目标文件，清单为 `data/sind-public/download-manifest.json`。`.parts` 是可复用下载缓存。

审查：`python scripts/audit-sind-public.py`。报告保存在同目录 `audit.json`，列出每个轨迹文件的行数、轨迹数、类型、时间范围、非有限值、非递增时间、超过 250 ms 缺口和无效尺寸。它不是地图配准或标注准确性验证。

本地保留官方 README、DATASETS.md、Format.md 与 LICENSE。官方文件标注非商业使用要求；此处不将其改写为无条件商业可用授权。

## 完整数据申请草稿（未发送）

官方联系人包括 `li-yw23@mails.tsinghua.edu.cn`、`hong_wang@tsinghua.edu.cn`、`13645450063@163.com`、`18975505069@163.com`。申请需提供真实姓名、地区、单位、实验室/院系、研究方向与使用目的。

Subject: [Apply for SinD] [Name]_[Country/Region]_[Organization]

Dear SinD team,

My name is [Name], and I am affiliated with [Laboratory/Department, Organization]. I am conducting non-commercial research on vehicle trajectory prediction and surrogate traffic-conflict analysis at signalized intersections in China.

I would like to apply for access to the full SinD dataset, including trajectories, traffic-light records, maps, recording metadata, and available semantic annotations. The intended use is to develop and independently evaluate trajectory prediction methods and build a real-data 3D replay and analysis interface. Multiple acquisition sessions are needed for separate training, validation, and test groups.

Please let me know the application procedure and applicable terms. I will follow the data-use requirements and cite the relevant publications.

Best regards,
[Name]
[Educational email]
[Laboratory/Department, Organization]

申请必须使用用户真实身份与邮箱；本次没有代发邮件或提交申请。

## 本次完成结果

新增 3 个城市公开记录，共 806,932 行轨迹观测、2,080 个文件内轨迹 ID（跨城市独立计数）。长春 442,675 行/1,411 条，重庆 244,002 行/230 条，西安 120,255 行/439 条。6 个轨迹文件均未检出非有限状态、非递增时间、超过 250 ms 的缺口或无效非行人尺寸。16 个下载文件均已校验。尚未转换成项目多城市评估输入，亦未进行异地地图配准。
