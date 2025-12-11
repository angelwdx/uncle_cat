1. **初始化Git仓库**

   * 在项目根目录执行 `git init`

   * 确保 `.gitignore` 文件包含所有必要的忽略规则

2. **添加并提交本地更改**

   * `git add .` 将所有整理后的文件添加到暂存区

   * `git commit -m "整理项目文件：删除旧版本文件，创建docs目录，优化项目结构"` 提交更改

3. **在GitHub上创建仓库**

   * 登录GitHub，创建一个新的仓库

   * 复制仓库的远程URL

4. **关联远程仓库**

   * `git remote add origin <your-github-repo-url>` 添加远程仓库

5. **推送代码到GitHub**

   * `git push -u origin main` 推送代码到GitHub

6. **验证推送结果**

   * 登录GitHub，检查仓库中的文件是否与本地一致

