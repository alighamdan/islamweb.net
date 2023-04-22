const fs = require("fs");
const path = require("path");
const isEmail = require("email-regex-safe");
const { execSync } = require("child_process");
const { parseHTML } = require("linkedom");
const {
  supportedPaperSizes,
  supportedOrientation,
  replace,
} = require("../../utils/utils");

module.exports = class IslamWebFatwa {
  /**
   *
   * @param {string} html
   */
  constructor(html) {
    this.source = html
      .replace(/\<font color="green"/gi, '<font color="#80e36a"')
      .replace(/\<font color="brown"/gi, '<font color="#dc5c53"')
      .replace(/\<font color="blue"/gi, '<font color="#1E90FF"');
  }

  getDetails(html = false) {
    let document = parseHTML(this.source).window.document;
    let language =
      document.querySelector('link[rel="amphtml"]')?.href?.split("/")?.[4] ||
      "ar";
    document.querySelectorAll("a").forEach((e) => {
      if (e.href.startsWith(`/${language}/`)) {
        e.href = `https://islamweb.net${e.href}`;
      }
    });
    document
      .querySelectorAll("span img[alt]")
      .forEach(
        (el) =>
          (el.outerHTML = `<span style="color:gold">${el.alt.trim()}</span>`)
      );
    let tree =
      Array.from(document.querySelectorAll("ol li"))
        .map((e) => e.textContent.trim())
        .join(" >> ") || undefined;

    let title = document
      .querySelector('h1[itemprop="name"]')
      ?.textContent?.trim();
    let publishDate = document
      .querySelector('meta[itemprop="datePublished"]')
      ?.content?.split("-");
    let publish = publishDate
      ? new Date(+publishDate[0], +publishDate[1] - 1, publishDate[2])
      : undefined;
    let author = document.querySelector('meta[itemprop="author"]')?.content;
    let fatwa_number = +document
      .querySelector(".iteminfo span")
      ?.textContent?.split(":")?.[1];
    let fatwa_question = document
      .querySelector('div[itemprop="text"]')
      ?.[html ? "innerHTML" : "textContent"]?.trim();
    let fatwa_answer = document
      .querySelector('div[itemprop="acceptedAnswer"] div[itemprop="text"]')
      ?.[html ? "innerHTML" : "textContent"]?.trim();

    let tabs_ids = Array.from(document.querySelectorAll("#tabs h1"));
    let related = {};
    for (let i = 0; i < tabs_ids.length; i++) {
      const tab = tabs_ids[i];
      let tab_id = tab.getAttribute("tab");
      let tab_name = tab.textContent.trim();
      related[tab_name] = Array.from(
        document.querySelectorAll(
          `#tab_container .tab_content.tab_${tab_id} > div`
        )
      ).map((el) => {
        let e = el.querySelector("a");
        return {
          title: el.querySelector("h2 a")?.textContent?.trim(),
          url: el.querySelector("h2 a")?.href
            ? `${el.querySelector("h2 a")?.href}`
            : undefined,
          short_url: e?.href?.split("/")?.slice(0, -1)?.join("/")
            ? `${e?.href?.split("/")?.slice(0, -1)?.join("/")}/`
            : undefined,
          img: el.querySelector("img")?.src
            ? `https://islamweb.net${el.querySelector("img")?.src}`
            : undefined,
          type: e.href.includes("audio.islamweb.net")
            ? "audio"
            : e?.href?.split("/")?.[4],
          number: isNaN(
            +(e.href.includes("audio.islamweb.net")
              ? new URL(e.href).searchParams.get("audioid")
              : e?.href?.split("/")?.[5])
          )
            ? undefined
            : e.href.includes("audio.islamweb.net")
            ? new URL(e.href).searchParams.get("audioid")
            : e?.href?.split("/")?.[5],
          author: Boolean(el.querySelector(".categorynem")?.textContent?.trim())
            ? el.querySelector(".categorynem")?.textContent?.trim()
            : undefined,
        };
      });
    }
    let fatwa_subjects = Array.from(
      document.querySelectorAll(".fatCatleft ul li")
    ).map((el) => {
      return {
        title: el.querySelector("a")?.textContent?.trim(),
        url: el.querySelector("a").href
          ? `${el.querySelector("a").href}`
          : undefined,
      };
    });
    let most_view = Array.from(
      document.querySelectorAll(".mostviewleft ul li")
    ).map((el) => {
      return {
        title: el.querySelector("h2 a")?.textContent?.trim(),
        url: el.querySelector("h2 a")?.href
          ? `${el.querySelector("h2 a")?.href}`
          : undefined,
        views: +el.querySelector("span")?.textContent,
        category: {
          name: el.querySelector("h2 + a")?.textContent?.trim(),
          url: el.querySelector("h2 + a")?.href
            ? `${el.querySelector("h2 + a")?.href}`
            : undefined,
        },
      };
    });

    return {
      tree,
      title,
      publish,
      author,
      fatwa_number,
      fatwa_question,
      fatwa_answer,
      related,
      fatwa_subjects,
      most_view,
      language,
    };
  }

  async print(
    {
      headersAndFooter: headersAndFooters,
      margin,
      size,
      orientation,
      executablePath,
    } = {
      headersAndFooter: true,
      margin: 6,
      size: "Letter",
      orientation: "Portrait",
      executablePath: process.env.WKHTMLTOPDF,
    }
  ) {
    headersAndFooters = Boolean(headersAndFooters);
    margin = isNaN(margin) || margin < 0 ? 6 : margin;
    size = supportedPaperSizes.includes(size) ? size : "Letter";
    orientation = supportedOrientation.includes(orientation)
      ? orientation
      : "Portrait";
    executablePath = fs.existsSync(executablePath)
      ? executablePath
      : process.env.WKHTMLTOPDF;
    if (!executablePath) {
      throw new ReferenceError(
        `Can't Find WkHtmlToPdf executable File \`set the path in process.env.WKHTMLTOPDF or in the options\``
      );
    }
    let d = this.getDetails(true);
    if (!d.title || !d.fatwa_question || !d.fatwa_answer) {
      throw new Error("check if this is a valid fatwa url - or refetch...");
    }
    let cmd = `"${executablePath}" `;
    cmd += `--log-level none -s "${size}" -O "${orientation}" --enable-local-file-access `;
    if (headersAndFooters) {
      cmd += `--header-left "${replace(
        d.language == "ar" ? `{islamic_date}` : `{title}`,
        d
      )}" `;
      cmd += `--header-right "${replace(
        d.language == "ar" ? `{title}` : `{islamic_date}`,
        d
      )}" `;
      cmd += `--footer-left "https://www.islamweb.net/${d.language}/fatwa/${d.fatwa_number}/" `;
      cmd += `--footer-right "Page [page]/[topage]" `;
    }
    cmd += `-T ${margin}mm -B ${margin}mm `;
    cmd += `-L ${Math.floor(margin / 2)}mm -R ${Math.floor(margin / 2)}mm `;
    cmd += `--footer-font-size 8 - -`;
    return execSync(cmd, {
      input: fs
        .readFileSync(
          path.resolve(__dirname, "../../utils/templates/fatwa/index.html"),
          "utf-8"
        )
        .replace(/\{QUESTION\}/gi, d.fatwa_question)
        .replace(/\{ANSWER\}/gi, d.fatwa_answer)
        .replace('"{DIRECTION}"', d.language == "ar" ? "rtl" : "ltr"),
      maxBuffer: 99999999999999999999,
    });
  }

  share(media = "whatsapp") {
    let { title, fatwa_number, language } = this.getDetails();
    if (media === "whatsapp") {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `https://www.islamweb.net/${language}/fatwa/${fatwa_number}/`
      )}`;
    } else if (media === "twitter") {
      return `https://twitter.com/intent/tweet?original_referer=${encodeURIComponent(
        "https://www.islamweb.net/"
      )}&ref_src=${encodeURIComponent(
        "twsrc^tfw|twcamp^buttonembed|twterm^share|twgr^"
      )}&text=${encodeURIComponent(title)}&url=${encodeURIComponent(
        `https://www.islamweb.net/${language}/fatwa/${fatwa_number}/`
      )}`;
    } else if (isEmail({ exact: true }).test(media)) {
      return `mailto:${encodeURIComponent(media)}?subject=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(
        `https://www.islamweb.net/${language}/fatwa/${fatwa_number}/`
      )}`;
    }
    throw new Error("Only 'whatsapp', 'twitter', 'mail' available");
  }

  get url() {
    let { language, fatwa_number } = this.getDetails();
    return `https://www.islamweb.net/${language}/fatwa/${fatwa_number}/`;
  }
};
