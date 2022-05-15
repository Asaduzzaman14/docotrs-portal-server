const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000





app.use(express.json())
app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zfgzh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect()
        const serviceCollaction = client.db('doctors-portal').collection('services')
        const bookingCollaction = client.db('doctors-portal').collection('booking')
        const userCollaction = client.db('doctors-portal').collection('users')



        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollaction.find(query)
            const service = await cursor.toArray()
            res.send(service)
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const result = await userCollaction.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECREET, { expiresIn: '1h' })
            res.send({ result, token });

        })

        /**
         * API NAMING COPNVANSON
         * 
         * app.get('/booking')           get all bookings in this is is collaction
         * app.get('/booking/:id')      get a spicific booking
         * app.post('/post')             add new booling
         * app.patch('/delete/:id')        
         * app.delete('/booking/:id')  
         * 
        */
        app.get('/booking', async (req, res) => {
            const patient = req.query.patient;
            const query = { patient: patient }
            const bookings = await bookingCollaction.find(query).toArray()

            res.send(bookings)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treetment: booking.treetment, date: booking.date, patent: booking.patent }
            const existes = await bookingCollaction.findOne(query);
            if (existes) {
                return res.send({ success: false, booking: existes })
            }
            else {
                const result = await bookingCollaction.insertOne(booking)
                return res.send({ success: true, booking: result })
            }

        });

        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 14, 2022';


            // step 1: get all services
            const services = await serviceCollaction.find().toArray()

            // step 2: get all booking of that day
            const query = { date } //{data: date}
            const booking = await bookingCollaction.find(query).toArray()



            // step 3: for each service, find booking for that service
            services.forEach(service => {

                const servicebooking = booking.filter(b => b.treetment === service.name);

                const booked = servicebooking.map(bs => bs.sloat)

                const available = service.slots.filter(s => !booked.includes(s))

                service.slots = available;
            })

            res.send(services)


        })





    }
    finally {

    }
}


run().catch(console.dir())



app.get('/', (req, res) => {
    res.send('server is runing')
})

app.listen(port, () => {
    console.log(`Doctors  portl litening  is ${port}`);
})