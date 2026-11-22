# yunhzou.github.io

Personal academic website of Yunheng Zou. Plain HTML/CSS/JS, no build step.

## Deploy on GitHub Pages

1. Create a public repo named `yunhzou.github.io` on GitHub.
2. Push the contents of this folder to its `main` branch.
3. In the repo: Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
4. The site goes live at https://yunhzou.github.io within a minute or two.

## Editing

- Text, news, and publications: `index.html`
- Styles and colors (light/dark tokens at the top): `assets/css/style.css`
- Robot-arm lab widget: `assets/js/lab.js` (the `SAMPLES` list maps each vial to a section)
- CV: replace `files/Yunheng_Zou_CV.pdf`
- Photo: `assets/img/profile.jpg` (square, ~720px)

Preview locally with `python3 -m http.server -d .` and open http://localhost:8000.
