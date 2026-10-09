$repo = "E:\Moffu"
Set-Location $repo

git config user.email "thebilaalmughal@gmail.com"
git config user.name "TheBilalMughal"

git commit --allow-empty -m "chore: trigger Vercel deploy"
git push

Write-Host "Deployed! Check Vercel dashboard." -ForegroundColor Green
Start-Sleep 3
