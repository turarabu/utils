const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { exec } = require('child_process')
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

if ( process.getuid && process.getuid() === 0 )
  start()
else console.log('You have to run script with root')


async function start () {
  const memory = {}

  memory.action = await writeAction('Action for port open/close: '),
  memory.port = await writePort('Port number: '),
  memory.configFile = path.join('/', 'etc', 'nginx', 'conf.d', `proxy-${memory.port}.conf`)

  if ( memory.action === 'open' ) {
    memory.serverName = await writeServerName('Enter nginx server_name: ')
    memory.host = await writeHost('Enter proxy target. \nFor example ws://11.22.33.44:8080 \nEnter: ')

    await saveConfig(memory)
    await openPort(memory)
  }

  else {
    await removeConfig(memory)
    await closePort(memory)
  }

  await nginxReload()
  console.log('Done!')

  process.exit(0)
}


function writeAction (questionText) {
  return new Promise(resolve => {
    rl.question(questionText, async answer => {
      const action = answer.toLowerCase()
  
      if ( action === 'open' || action === 'close' )
        return resolve(action)

      else {
        const retry = await writeAction('You have to answer "open" or "close": ')
        return resolve(retry)
      }
  
    })
  })
}


function writePort (questionText) {
  return new Promise(resolve => {
    rl.question(questionText, async answer => {
      const port = Number(answer)
  
      if ( port > 0 && port < (2**16) - 1 )
        return resolve(port)

      else {
        const retry = await writeAction(`Port must be a number bigger 0 and lower ${(2**16)}. \nPlease try again: `)
        return resolve(retry)
      }
  
    })
  })
}


function writeHost (questionText) {
  return new Promise(resolve => {
    rl.question(questionText, async answer => {
      const host = answer.toLowerCase()
      return resolve(host)
  
    })
  })
}


function writeServerName (questionText) {
  return new Promise(resolve => {
    rl.question(questionText, async answer => {
      const host = answer.toLowerCase()
      return resolve(host)
  
    })
  })
}


function saveConfig ({ configFile, serverName, host, port }) {
  return new Promise(resolve => {
    const configData = generateConfig(serverName, host, port)

    if ( fs.existsSync(configFile) )
      console.log(`Config for port ${port} already exists! \nRewriting config file...`)
    else console.log('Creating nginx proxy config...')

    fs.writeFile(configFile, configData, error => {
      // TODO: error handler
      return resolve()
    })
  })
}


function removeConfig ({ configFile }) {
  return new Promise(resolve => {
    if ( fs.existsSync(configFile) ) {
      console.log('Removeing nginx proxy config...')

      fs.unlink(configFile, error => {
        // TODO: error handler
        return resolve()
      })
    }
    
    else console.log(`Config for port ${port} does not exists!`)
  })
}


function generateConfig (serverName, host, port) {
  return `
    server {
      listen ${ port };
      server_name ${ serverName };

      access_log /var/log/nginx/${ serverName }-access.log;
      error_log /var/log/nginx/${ serverName }-error.log;

      location / {
        proxy_pass ${ host };
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
      }
    }
  `
}


function openPort ({ port }) {
  console.log('Adding port to firewall exceptions...')

  return new Promise(resolve => {
    const child = exec(`firewall-cmd --zone=public --add-port=${ port }/tcp --permanent`)

    child.on('close', async () => {
      await firewallReload()
      return resolve()
    })
  })
}


function closePort ({ port }) {
  console.log('Removing port from firewall exceptions...')

  return new Promise(resolve => {
    const child = exec(`firewall-cmd --zone=public --remove-port=${ port }/tcp --permanent`)

    child.on('close', async () => {
      await firewallReload()
      return resolve()
    })
  })
}


function firewallReload () {
  console.log('Reloading firewall...')

  return new Promise(resolve => {
    exec(`firewall-cmd --reload`)
      .on('close', resolve)
  })
}

function nginxReload () {
  console.log('Reloading nginx...')

  return new Promise(resolve => {
    exec(`systemctl restart nginx`)
      .on('close', resolve)
  })
}