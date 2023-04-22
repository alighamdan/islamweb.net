const { default: axios } = require("axios");
const { decode } = require("iconv-lite");
const { parseHTML } = require("linkedom");
const IslamWebFatwa = require("./fatwa");

async function search(query, options = {}) {
  if (!query) throw new Error("Query is required");
  if (!options.type) options.type = "splitted_words";
  if (!options.only_titles) options.only_titles = false;
  if (!options.start) options.start = 0;
  if (!options.fullFetch) options.fullFetch = false;
  if (!options.html) options.html = false;
  let whereToSearch = options.only_titles ? 1 : 0;
  let R1 = options.type === "hole_words" ? 1 : 0;
  let res = await axios.postForm(
    `https://search.islamweb.net/ver3/ar/SearchEngine/fattab.php`,
    {
      wheretosearch: whereToSearch,
      R1,
      txt: query,
      start: options.start,
    },
    { responseType: options.fullFetch ? "text" : "arraybuffer" }
  );
  let document = parseHTML(
    options.fullFetch ? res.data : decode(res.data, "windows-1256")
  ).window.document;

  let next_page = document
    .querySelectorAll("option")
    [
      Array.from(document.querySelectorAll("option")).findIndex(
        (e) => !!e?.hasAttribute("selected")
      ) + 1
    ]?.getAttribute("value");
  if (isNaN(next_page)) next_page = 0;
  else next_page = Number(next_page);
  let fatwas = options.fullFetch
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
                return new IslamWebFatwa(res.data);
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
          if (!d.fatwa_question || !d.fatwa_answer || !d.title) return false;
          return true;
        })
    : Array.from(document.querySelectorAll("ul.oneitems li"))
        .map((el) => {
          let url = el.querySelector("a").href
            ? `https://islamweb.net${el.querySelector("a").href}`
            : undefined;
          if (!url) return undefined;
          let title = el.querySelector("a")?.[options.html ? 'innerHTML' : 'textContent']?.trim();
          let fatwa_number = +url.split("/")[5];
          return {
            title,
            url,
            fatwa_number,
          };
        })
        .filter(Boolean);

  return {
    fatwas,
    next_page,
  };
}

async function homepage(fullFetch = false) {
  let { data: html } = await axios.get("https://www.islamweb.net/ar/fatwa/");
  let document = parseHTML(html).window.document;

  let top = [];
  document.querySelector(".mainitem p a")?.remove();
  document.querySelector(".mainitem h2 a")?.href &&
    top.push({
      title: document.querySelector(".mainitem h2 a")?.textContent?.trim(),
      url: document.querySelector(".mainitem h2 a")?.href
        ? `https://islamweb.net${
            document.querySelector(".mainitem h2 a")?.href
          }`
        : undefined,
      fatwa_number: +document
        .querySelector(".mainitem h2 a")
        ?.href?.split("/")?.[3],
    });

  let t = Array.from(document.querySelectorAll("ul.fouritems li"));
  for (let i = 0; i < t.length; i++) {
    const element = t[i];
    let url = element.querySelector("a")?.href
      ? `https://islamweb.net${element.querySelector("a")?.href}`
      : undefined;
    if (!url) return undefined;
    top.push({
      title: element.querySelector("a h2")?.textContent?.trim(),
      url,
      fatwa_number: +element.querySelector("a")?.href?.split("/")?.[3],
    });
  }

  top = fullFetch
    ? (
        await Promise.all(
          top.filter(Boolean).map(async (url) => {
            try {
              let res = await axios.get(url.url);
              return new IslamWebFatwa(res.data);
            } catch (error) {
              return undefined;
            }
          })
        )
      )
        .filter(Boolean)
        .filter((f) => {
          let d = f.getDetails();
          if (!d.fatwa_question || !d.fatwa_answer || !d.title) return false;
          return true;
        })
    : top.filter(Boolean);

  let news = fullFetch
    ? (
        await Promise.all(
          Array.from(document.querySelectorAll("#moreistiarea li")).map(
            async (el) => {
              let url = el.querySelector("h2 a").href
                ? `https://islamweb.net${el.querySelector("h2 a").href}`
                : undefined;
              if (!url) return false;
              try {
                let res = await axios.get(url);
                return new IslamWebFatwa(res.data);
              } catch (error) {
                return false;
              }
            }
          )
        )
      )
        .filter(Boolean)
        .filter((f) => {
          let d = f.getDetails();
          if (!d.fatwa_question || !d.fatwa_answer || !d.title) return false;
          return true;
        })
    : Array.from(document.querySelectorAll("#moreistiarea li"))
        .map((el) => {
          let url = el.querySelector("h2 a")?.href
            ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
            : undefined;
          if (!url) return undefined;
          let title = el.querySelector("h2 a")?.textContent?.trim();
          let fatwa_number = +url.split("/")[5];
          el.querySelectorAll("p *").forEach((e) => e.remove());
          let short_content = el.querySelector("p")?.textContent?.trim();
          return { title, url, fatwa_number, short_content };
        })
        .filter(Boolean);

  let fatwa_subjects = Array.from(
    document.querySelectorAll(".fatCatleft.right ul li")
  ).map((el) => {
    el.querySelectorAll("a *").forEach((e) => e.remove());
    return {
      title: el.querySelector("a")?.textContent?.trim(),
      url: el.querySelector("a")?.href
        ? `https://islamweb.net${el.querySelector("a")?.href}`
        : undefined,
    };
  });

  let most_view = Array.from(
    document.querySelectorAll(".mostviewleft ul li")
  ).map((el) => {
    return {
      title: el.querySelector("h2 a")?.textContent?.trim(),
      url: el.querySelector("h2 a")?.href
        ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
        : undefined,
      views: +el.querySelector("span")?.textContent,
      category: {
        name: el.querySelector("h2 + a")?.textContent?.trim(),
        url: el.querySelector("h2 + a")?.href
          ? `https://islamweb.net${el.querySelector("h2 + a")?.href}`
          : undefined,
      },
    };
  });

  return {
    top,
    news,
    fatwa_subjects,
    most_view,
  };
}

async function get_fatawa(url, fullFetch = false) {
  if (!url) throw new Error("Url is Required");
  let { data: html } = await axios.get(url);
  let document = parseHTML(html).window.document;
  let folders = Array.from(document.querySelectorAll("ul.tree li")).map(
    (el) => {
      let urL = el.querySelector("a")?.href;
      if (!urL) {
        urL = el.querySelector("a")?.getAttribute("onclick")?.split("'")?.[3];
        if (urL) urL = `https://islamweb.net${urL}`;
        else urL = undefined;
      } else {
        urL = `https://islamweb.net${urL}`;
      }
      return {
        name: el.querySelector("a")?.textContent?.trim(),
        url: urL,
      };
    }
  );

  let fatwas = fullFetch
    ? (
        await Promise.all(
          Array.from(document.querySelectorAll("ul.oneitems li")).map(
            async (el) => {
              let url = el.querySelector("h2 a")?.href
                ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
                : undefined;
              if (!url) return undefined;
              try {
                let res = await axios.get(url);
                return new IslamWebFatwa(res.data);
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
            !!d.fatwa_question &&
            !!d.fatwa_answer &&
            !!d.title &&
            !!d.fatwa_number
          );
        })
    : Array.from(document.querySelectorAll("ul.oneitems li"))
        .map((el) => {
          let url = el.querySelector("h2 a")?.href
            ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
            : undefined;
          if (!url) return undefined;
          let title = el.querySelector("h2 a")?.textContent?.trim();
          let fatwa_number = +url.split("/")[5];
          el.querySelectorAll("p *").forEach((e) => e.remove());
          let short_content = el.querySelector("p")?.textContent?.trim();
          return { title, url, fatwa_number, short_content };
        })
        .filter(Boolean);

  let sub_sections = Array.from(
    document.querySelectorAll(".leftblock.fatCatleft ul li")
  ).map((el) => ({
    title: el.querySelector("a").textContent,
    url: `https://islamweb.net${el.querySelector("a").href}`,
  }));

  let previous_page;
  let current_page;
  let next_page;
  let last_page = 0;
  let t = Array.from(document.querySelectorAll("ul.pagination li"));
  for (let i = 0; i < t.length; i++) {
    const l = t[i];
    if (l.className.includes("active")) {
      previous_page = t[i - 1]
        ? `${url.split("?")[0]}${t[i - 1].querySelector("a").href}`
        : undefined;
      current_page = +l.querySelector("a").textContent.trim();
      next_page = t[i + 1]
        ? `${url.split("?")[0].split("&")[0]}${
            t[i + 1].querySelector("a").href
          }`
        : undefined;
    }
    let pn = l.querySelector("a")?.href?.split("=")?.[1]?.split("&")?.[0];
    if (pn > last_page) last_page = +pn;
  }

  return {
    fatwas,
    folders,
    sub_sections,
    pages: {
      previous: previous_page,
      current: current_page,
      next: next_page,
      last: last_page,
    },
  };
}

async function get_fatwa(url) {
  if (!url) throw new Error("Url is required");
  let { data: html } = await axios.get(url);
  return new IslamWebFatwa(html);
}

module.exports.search = search;
module.exports.homepage = homepage;
module.exports.get_fatawa = get_fatawa;
module.exports.get_fatwa = get_fatwa;
