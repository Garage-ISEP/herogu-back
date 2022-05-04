import { firstValueFrom } from 'rxjs';
import { HttpService } from "@nestjs/axios";
import * as rd from "readline";

const baseUrl = "https://api.herogu.garageisep.com/project";
const token = ""; //JWT token
const http = new HttpService();
const options = { headers: { "Authorization": "Bearer " + token } };

function waitInput() {
  const rl = rd.createInterface({
      input: process.stdin,
      output: process.stdout,
  });

  return new Promise(resolve => rl.question("", ans => {
      rl.close();
      resolve(ans);
  }))
}


async function main() {
  await waitInput();
  let projects = [];
  for (let i = 0; i < 10; i++) {
    await Promise.all(Array.from({ length: 10 }, (_, j) => { 
      return new Promise<void>(async resolve => {
        const projectName = "test" + i + j;
        try {
          console.log(`${projectName} Adding project`);
          const res = await firstValueFrom(http.post(baseUrl, {
            name: projectName,
            githubLink: "https://github.com/totodore/herogu-test-php",
            type: "php",
            mysqlEnabled: true,
            notificationsEnabled: true,
            addedUsers: ["test1", "test2"],
            rootDir: "/"
          }, options));
          const id = res.data.id;
          projects.push(id);
          console.log(`${projectName} Adding github link`);
          // await firstValueFrom(http.post(baseUrl + "/" + id + "/github-link", undefined, options));
          console.log(`${projectName} Adding mysql link`);
          await firstValueFrom(http.post(baseUrl + "/" + id + "/mysql-link", undefined, options));
          console.log(`${projectName} Adding docker link`);
          await firstValueFrom(http.post(baseUrl + "/" + id + "/docker-link", undefined, options));
        } catch (e) {
          console.log("Exception at iteration " + i + " " + j);
          console.log()
          console.error(e.response.data);
        } finally {
          console.log("Iteration " + i + " " + j + " done");
          resolve();
        }
      });
    }));
  }

  console.log("Done");
  await waitInput();
  await Promise.all(projects.map(id => {
    return new Promise<void>(async resolve => {
      console.log("Deleting project " + id);
      try {
        await firstValueFrom(http.delete(baseUrl + "/" + id, options));
      } catch (e) {
        console.log("Exception at project " + id);
        console.log()
        console.error(e.response.data);
      } finally {
        console.log("Deleted project " + id);
        resolve();
      }
    });
  }));

}


main();