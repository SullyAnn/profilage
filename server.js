const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());

const port = 3000;
let currentImagePath = ""; 
let htmlContent = "";
let javascriptContent ="";
let styleContent ="";
let filename ="";


app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});



app.use('/images', express.static('C:\\Users\\uac-ssorimoutou\\Desktop\\Puppeter_mesures\\images'));

app.post('/run-SaveDataAllTypes', (req, res) => {
  currentImagePath = req.body.image;
  htmlContent =  `<img src="http://localhost:3000/images/${currentImagePath}" alt="image de toits" />`
  htmlContent += req.body.html;
  javascriptContent += req.body.javascript;
  styleContent += req.body.css;
  filename = req.body.filename;
  
  res.send('Code set');
});

app.get('/download-trace', (req, res) => {
  res.download(`path/to/${filename}.json`);
});

app.get('/run-puppeteer', async (req, res) => {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: false });
      const context = await browser.createIncognitoBrowserContext();
      //!désactiver extensions!
      const page = await context.newPage();
      
      // activation protocole chrom devtools
      const client = await page.target().createCDPSession();

      // écoute réseaux et performance 
      await client.send('Network.enable');
      await client.send('Tracing.start');
  

      // information de chargement
      client.on('Network.responseReceived', (response) => {
        if (response.response.url.endsWith('.png')) {
          console.log('Réponse pour image PNG reçue:', response.response);
        }
      });

      const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mon Gabarit de Base</title>
      </head>
      <body>
          ${htmlContent}
      </body>
      </html> 
      
      <script> 
        ${javascriptContent}
      </script>
      
      <style>
        ${styleContent}
      </style>`
      ;
      await page.setContent(template);

      // récupération métrique de performance 
      // !end quand intéraction terminée s'il y en a une, ou conserver time out! 
      await client.send('Tracing.end');

      let traceData = [];
      client.on('Tracing.dataCollected', params => {
          traceData.push(...params.value);
      });
      
      // Lorsque la traçabilité est complètement arrêtée
      const tracingComplete = new Promise((resolve) => {
        client.once('Tracing.tracingComplete', async () => {
            console.log('Trace sauvegardée');
            fs.writeFileSync(`./traces/${filename}.json`, JSON.stringify(traceData));
            resolve();  
        });
    });
      
      // time out mis manuellement. Dans l'idéal le faire terminer après avoir recup données 
      // await new Promise(r => setTimeout(r, 5000));
      await tracingComplete;

      // 3. Désactiver l'écoute et récupération des données 
      await client.send('Network.disable');



      await browser.close();
      res.send('Puppeteer a fini de s’exécuter!');
    } catch (error) {
      console.error('Erreur lors de l’exécution de Puppeteer:', error);
      if (browser) await browser.close();
      res.status(500).send('Erreur lors de l’exécution de Puppeteer.');
    }
  });



app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
