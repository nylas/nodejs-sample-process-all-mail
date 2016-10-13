# Nylas Webhook Consumer

This sample application demonstrates how to process replies users receive to
specific threads in their inbox. (Threads you created using the /send endpoint,
or otherwise identified.)

# Dependencies

## ngrok

[ngrok](https://ngrok.com/) makes it really easy to test callback urls that are
running locally on your computer.

## node / npm

Make sure `node` and `npm` are installed. **This example requires Node 4.0 or greater.**

# Getting Started

1. Install Dependencies:

```bash
npm install
```

2. Place your Nylas App ID and Secret in `config.js`

# Running

First, make sure ngrok is running with the same port that the local express app
is running.

```bash
ngrok http 1234
```

Next, run the express app.

```bash
npm start
```

Follow the instructions that are printed to the console.
