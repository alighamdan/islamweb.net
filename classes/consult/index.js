const { default: axios } = require("axios");
const { decode } = require("iconv-lite");
const { parseHTML } = require("linkedom");
const IslamWebConsult = require("./consult");

async function search(query, options = {}) {
  if (!query) throw new Error("Query is required");
  if (!options.type) options.type = "splitted_words";
  if (!options.only_titles) options.only_titles = false;
  if (!options.start) options.start = 0;
  if (!options.fullFetch) options.fullFetch = false;
  if (!options.html) options.html = false;
  let whereToSearch = options.only_titles ? 1 : 0;
  let R1 = options.type === "hold_words" ? 1 : 0;
  let res = await axios.postForm(
    `https://search.islamweb.net/ver3/ar/SearchEngine/reqtab.php`,
    {
      wheretosearch: whereToSearch,
      R1,
      txt: query,
      start: options.start,
    }, { responseType: options.fullFetch ? `text` : 'arraybuffer' }
  );
  let document = parseHTML(options.fullFetch ? res.data : decode(res.data, 'windows-1256')).window.document;

  let next_page = document
    .querySelectorAll("option")
    [
      Array.from(document.querySelectorAll("option")).findIndex(
        (e) => !!e?.hasAttribute("selected")
      ) + 1
    ]?.getAttribute("value");
  if (isNaN(next_page)) next_page = 0;
  else next_page = Number(next_page);
  let consults = options.fullFetch
    ? (
        await Promise.all(
          Array.from(document.querySelectorAll("ul.oneitems li")).map(
            async (el) => {
              let url = el.querySelector("a").href
                ? `https://islamweb.net${el.querySelector("a").href}`
                : undefined;
              if (!url) return undefined;
              try {
                let res = await axios.get(url);
                return new IslamWebConsult(res.data);
              } catch (error) {
                return undefined;
              }
            }
          )
        )
      )
        .filter(Boolean)
        .filter((f) => {
          let d = f.getDetails();
          if (!d.consult_question || !d.consult_answer || !d.title)
            return false;
          return true;
        })
    : Array.from(document.querySelectorAll("ul.oneitems li"))
        .map((el) => {
          let url = el.querySelector("a").href
            ? `https://islamweb.net${el.querySelector("a").href}`
            : undefined;
          if (!url) return undefined;
          let title = el.querySelector("a")?.[options.html ? 'innerHTML' : 'textContent']?.trim();
          return {
            title,
            url,
          };
        })
        .filter(Boolean);

  return {
    consults,
    next_page,
  };
}

async function homepage(fullFetch = false) {
  let { data: html } = await axios.get("https://www.islamweb.net/ar/consult/");
  let document = parseHTML(html).window.document;

  let top = [];
  document.querySelector(".mainitem p a")?.remove();
  document.querySelector(".mainitem")?.href &&
    top.push({
      title: document.querySelector(".mainitem h2 a")?.textContent?.trim(),
      url: `https://islamweb.net${
        document.querySelector(".mainitem h2 a")?.href
      }`,
      consult_number: +document
        .querySelector(".mainitem h2 a")
        ?.href?.split("/")?.[3],
    });

  let t = Array.from(document.querySelectorAll("ul.fouritems li"));
  for (let i = 0; i < t.length; i++) {
    const element = t[i];
    let url = element.querySelector("a")?.href
      ? `https://islamweb.net${element.querySelector("a")?.href}`
      : undefined;
    if (!url) continue;
    let title = element.querySelector("a h2")?.textContent?.trim();
    let consult_number = +element.querySelector('a')?.href.split("/")?.[3];
    top.push({ title, url, consult_number });
  }

  top = fullFetch
    ? (
        await Promise.all(
          top.filter(Boolean).map(async (url) => {
            try {
              let res = await axios.get(url.url);
              return new IslamWebConsult(res.data);
            } catch (error) {
              return undefined;
            }
          })
        )
      )
        .filter(Boolean)
        .filter((f) => {
          let d = f.getDetails();
          if (!d.consult_question || !d.consult_answer || !d.title)
            return false;
          return true;
        })
    : top.filter(Boolean);

  let consult_subjects = Array.from(
    document.querySelectorAll(".fatCatleft.right ul li")
  ).map((el) => {
    el.querySelectorAll("a *").forEach((e) => e.remove());
    return {
      title: el.querySelector("a")?.textContent?.trim(),
      url: el.querySelector("a")?.href
        ? `https://www.islamweb.net/ar/consult/${el.querySelector("a")?.href}`
        : undefined,
    };
  });

  let most_view = Array.from(
    document.querySelectorAll(".mostviewleft ul li")
  ).map((el) => {
    return {
      title: el.querySelector("h2 a")?.textContent?.trim(),
      url: el.querySelector("h2 a")?.href
        ? `https://www.islamweb.net/ar/consult/${
            el.querySelector("h2 a")?.href
          }`
        : undefined,
      views: +el.querySelector("span")?.textContent,
      category: {
        name: el.querySelector("h2 + a")?.textContent?.trim(),
        url: el.querySelector("h2 + a")?.href
          ? `https://www.islamweb.net/ar/consult/${
              el.querySelector("h2 + a")?.href
            }`
          : undefined,
      },
    };
  });

  return {
    top,
    consult_subjects,
    most_view,
  };
}

async function get_consults(url, fullFetch = false) {
  if (!url) throw new Error("Url is required");
  let { data: html } = await axios.get(url);
  let document = parseHTML(html).window.document;
  let folders = Array.from(document.querySelectorAll("ul.tree li")).map(
    (el) => {
      let urL = el.querySelector("a")?.href;
      if (!urL) {
        urL = el.querySelector("a")?.getAttribute("onclick")?.split("'")?.[3];
        if (urL) urL = `https://www.islamweb.net/ar/consult/${urL}`;
        else urL = undefined;
      } else {
        urL = `https://www.islamweb.net/ar/consult/${urL}`;
      }
      return {
        name: el.querySelector("a")?.textContent?.trim(),
        url: urL,
      };
    }
  );
  let consults = fullFetch
    ? (
        await Promise.all(
          Array.from(document.querySelectorAll("ul.oneitems li")).map(
            async (el) => {
              let url = el.querySelector("h2 a")?.href
                ? `https://www.islamweb.net/ar/consult/${
                    el.querySelector("h2 a")?.href
                  }`
                : undefined;
              if (!url) return undefined;
              try {
                let res = await axios.get(url);
                return new IslamWebConsult(res.data);
              } catch (error) {
                return undefined;
              }
            }
          )
        )
      )
        .filter(Boolean)
        .filter((f) => {
          let d = f.getDetails();
          return (
            !!d.consult_question &&
            !!d.consult_answer &&
            !!d.title &&
            !!d.consult_number
          );
        })
    : Array.from(document.querySelectorAll("ul.oneitems li"))
        .map((el) => {
          let url = el.querySelector("h2 a")?.href
            ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
            : undefined;
          if (!url) return undefined;
          let title = el.querySelector("h2 a")?.textContent?.trim();
          let consult_number = new URL(url).searchParams.get("id");
          el.querySelectorAll("p *").forEach((e) => e.remove());
          let short_content = el.querySelector("p")?.textContent?.trim();

          return { title, url, consult_number, short_content };
        })
        .filter(Boolean);

  let previous_page;
  let current_page;
  let next_page;
  let last_page = 0;
  let t = Array.from(document.querySelectorAll("ul.pagination li"));
  for (let i = 0; i < t.length; i++) {
    const l = t[i];
    if (l.className.includes("active")) {
      previous_page = t[i - 1]
        ? `${url.split("?")[0]}?${
            t[i - 1].querySelector("a").href.split("?")[1]
          }`
        : undefined;
      current_page = +l.querySelector("a").textContent.trim();
      next_page = t[i + 1]
        ? `${url.split("?")[0].split("&")[0]}?${
            t[i + 1].querySelector("a").href.split("?")[1]
          }`
        : undefined;
    }
    let pn = l
      .querySelector("a")
      ?.href?.split("&")
      ?.reverse()?.[0]
      ?.split("=")[1];
    if (pn > last_page) last_page = +pn;
  }

  return {
    consults,
    folders,
    pages: {
      previous: previous_page,
      current: current_page,
      next: next_page,
      last: last_page,
    },
  };
}

async function get_consult(url) {
  if (!url) throw new Error("Url is required");
  let { data: html } = await axios.get(url);
  return new IslamWebConsult(html);
}

module.exports.search = search;
module.exports.homepage = homepage;
module.exports.get_consults = get_consults;
module.exports.get_consult = get_consult;
