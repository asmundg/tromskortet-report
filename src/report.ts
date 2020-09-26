import puppeteer from "puppeteer";
import fs from "fs";

interface Result {
  name: string;
  value: string;
}

async function report(page: puppeteer.Page): Promise<Result[]> {
  const credentials = JSON.parse(
    fs.readFileSync(".credentials.json", "utf-8")
  ) as {
    user: string;
    pw: string;
  };

  await page.goto(
    "https://www.tromskortet.no/nettbutikk-tromskortet/category1508.html"
  );

  const handle = await page
    .waitForSelector(
      "iframe[src='https://admin.api.fara.no/fs-webshop-client/#/home/login?pta=TFT']"
    )
    .then((frame) => frame.contentFrame());
  if (!handle) {
    throw new Error("No iframe");
  }

  await handle
    .waitForSelector("#formLoginInputUsername", { timeout: 1000 })
    .then((el) => el.type(credentials.user, { delay: 500 }));
  await handle
    .waitForSelector("#formLoginInputPassword")
    .then((el) => el.type(credentials.pw, { delay: 500 }));
  await handle
    .waitForSelector("#formLoginButtonSubmit")
    .then((el) => el.click());

  await handle.waitForSelector("[card='card']");
  // Value is loaded async
  await handle.waitForSelector(".webshop-purse-saldo");
  console.log("Logged in");

  const res = await Promise.all(
    (await handle.$$("[card='card']")).map(async (el) => {
      const name = await el
        .$("strong")
        .then((el) => el?.getProperty("textContent"))
        .then((el) => el?.jsonValue());
      const value = await el
        .$(".webshop-purse-saldo")
        .then((el) => el?.$(".webshop-card-col-top"))
        .then((el) => el?.getProperty("textContent"))
        .then((el) => el?.jsonValue());
      return { name, value } as Result;
    })
  );

  return res.filter((res) => res.name);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  try {
    const res = await report(page);
    console.log(res);
  } catch (ex) {
    console.error(ex);
    await page.screenshot({
      path: `/tmp/oops.png`,
      fullPage: true,
    });
    fs.writeFile(
      `/tmp/oops.dom.txt`,
      await page.evaluate(() => document.body.innerHTML),
      () => {}
    );
  }

  await browser.close();
}

main();
