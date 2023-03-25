const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { request } = require('express');
require('dotenv').config();
const port = process.env.PORT || 5000

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)



app.use(express.json())
app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zfgzh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        // console.log(err);
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db('doctors-portal').collection('services')
        const bookingCollection = client.db('doctors-portal').collection('booking')
        const userCollection = client.db('doctors-portal').collection('users')
        const doctorCollection = client.db('doctors-portal').collection('doctors')
        const paymentsCollection = client.db('doctors-portal').collection('payments')


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }

        }

        // mailChamp
        app.post('/subscribe', (req, res) => {
            const { email } = req.body
            console.log(req.body);


            const myData = {
                mambers: {
                    email_address: email,
                    status: 'pandicg',
                }
            }
            const myDataPost = JSON.stringify(myData)

            const options = {
                url: '',
                method: 'POST',
                headers: {
                    authorization: `AUTH ..`
                },
                body: myDataPost
            }

            if (email) {
                request(options, (err, response, body) => {
                    if (err) {
                        res.json({ error: err })
                    } else {
                        if (js) {
                            res.sendStatus(200);
                        } else {
                            res.redirect('/success.html')
                        }
                    }
                })

            } else {
                res.status(404).send({ message: 'Failed' })
            }

        })


        // paymant
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        })

        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentsCollection.insertOne(payment)
            const updatedBooking = await bookingCollection.updateOne(filter, updateDoc)
            res.send(updatedBooking)
        })

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const service = await cursor.toArray()
            res.send(service)
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })



        // admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send({ result });

        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
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
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;
            console.log('user email', decodedEmail);
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                res.send(bookings)
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }

        })



        app.post('/booking', async (req, res) => {
            const booking = req.body;

            const query = { treetment: booking.treetment, date: booking.date, patient: booking.patient }
            console.log('this is qury', query);
            const existes = await bookingCollection.findOne(query);

            if (existes) {
                return res.send({ success: false, booking: existes })
            }
            else {
                const result = await bookingCollection.insertOne(booking)
                return res.send({ success: true, booking: result })
            }

        });

        app.get('/available', async (req, res) => {
            const date = req.query.date;


            // step 1: get all services
            const services = await serviceCollection.find().toArray()

            // step 2: get all booking of that day
            const query = { date } //{data: date}
            const booking = await bookingCollection.find(query).toArray()



            // step 3: for each service, find booking for that service
            services.forEach(service => {

                const servicebooking = booking.filter(b => b.treetment === service.name);

                const booked = servicebooking.map(bs => bs.sloat)

                const available = service.slots.filter(s => !booked.includes(s))

                service.slots = available;
            })

            res.send(services)


        })

        // payment 
        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.findOne(query)
            res.send(result)
        })



        // add doctor

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })


        // get all doctor 
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray()
            res.send(result)
        })

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const result = await doctorCollection.deleteOne(query)
            res.send(result)
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