const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

// Token Related
const jwt = require('jsonwebtoken')

const cookieParser = require('cookie-parser')

require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;


// Middleware
app.use(cors({
    origin :[
        'http://localhost:5173',
        'https://libease-client-b9a11-57399.web.app',
        'https://libease-client-b9a11-57399.firebaseapp.com'
    ],
    credentials : true
}));
app.use(express.json());

app.use(cookieParser())

// Our Own Middleware

const verifyToken = (req, res, next) => {
    const token = req.cookies.token
    console.log('Token In The Middleware', token)

    if (!token) {
        return res.status(401).send({ message: 'Access Not Authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Access Not Authorized' })
        }
        req.user = decoded;
        next()

    })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjbmdks.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const cookieOption = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // Collection-1
        // const allBookCollection = client.db('bookDB').collection('books')
        const librarianCollection = client.db('librarianDB').collection('librarianBooks')

        const categoryCollection = client.db('librarianDB').collection('category')

        const borrowCollection = client.db('librarianDB').collection('borrower')

        // __________________________________________Token Operations_______________________________________

        // Login & Registration Token
        app.post('/jwt', async(req,res)=>{
            const user = req.body
            // console.log('User For Token', user)
            const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, {expiresIn:'1h'})

            res.cookie('token',token,cookieOption).send({success:true})
        })

        //Token clearing
        app.post('/logout', async(req,res)=>{
            const user = req.body;

            res.clearCookie('token',  { ...cookieOption, maxAge: 0 }).send({success:true})
        })

        app.get('/admin-email', async (req, res) => {
                const adminInfo = await librarianCollection.findOne({}, { projection: { 'adminInfo.admin_email': 1, _id: 0 } });
                res.json(adminInfo.adminInfo.admin_email);
        });

        // ________________________________________All Operations____________________________________________
        
        // Get All Added Data
        app.get('/all-books',verifyToken, async (req, res) => {

            // Logic Jabe ekahne jodi logged in user er email !== admin email
            const adminInfo = await librarianCollection.findOne({}, { projection: { 'adminInfo.admin_email': 1, _id: 0 } });
            if(req.query.email !== adminInfo.adminInfo.admin_email){
                return res.status(403).send('Forbidden Access')
            }
            // console.log('Cookies :',req.cookies)
            let filter = {};

            if (req.query.filter === "available") {
                filter = { book_quantity: { $gt: parseInt("0")}};
            }
            else if (req.query.filter === "stockOut") {
                filter = { book_quantity: { $lte: parseInt("0")} };
            }

            const cursor = librarianCollection.find(filter);
            const result = await cursor.toArray();
            res.send(result)
        })
        // Get All Borrowed Data
        app.get('/borrowed-books/:email', async (req, res) => {
            const result = await borrowCollection.find({ borrower_email: req.params.email }).toArray()
            res.send(result)
        })
        // Get Categorized Data 
        app.get('/categorizedBooks/:category', async (req, res) => {
            const result = await librarianCollection.find({ book_category: req.params.category }).toArray()
            res.send(result)
        })

        // Get All Category Data
        app.get('/all-categories', async (req, res) => {
            const cursor = categoryCollection.find();
            const result = await cursor.toArray();
            res.send(result)
        })


        // Get Specific Item
        app.get('/all-books/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await librarianCollection.findOne(query)
            res.send(result)
        })

        // Add a Book
        app.post('/add-book',verifyToken, async (req, res) => {
            const newBook = req.body;

            // Logic Jabe ekahne jodi logged in user er email !== admin email
            const adminInfo = await librarianCollection.findOne({}, { projection: { 'adminInfo.admin_email': 1, _id: 0 } });
            if(req.query.email !== adminInfo.adminInfo.admin_email){
                return res.status(403).send('Forbidden Access')
            }
            // console.log(newBook)
            const result = await librarianCollection.insertOne(newBook);
            res.send(result)
        })

        // Add a Borrow Data
        app.post('/add-borrowed-book', async (req, res) => {
            const borrowedBook = req.body;
            // console.log(borrowedBook)

            const query = {
                borrower_email: borrowedBook.borrower_email,
                borrow_id: borrowedBook.borrow_id,
            }
            const alreadyBorrowed = await borrowCollection.findOne(query)
            console.log(alreadyBorrowed)

            if (alreadyBorrowed) {
                return res
                    .status(400)
                    .send('You have already Borrowed This Book.')
            }

            const result = await borrowCollection.insertOne(borrowedBook);

            // update book count
            const updateDoc = {
                $inc: { book_quantity: -1 },
            }
            const borrowQuery = { _id: new ObjectId(borrowedBook.borrow_id) }
            const updateBookQuantity = await librarianCollection.updateOne(borrowQuery, updateDoc)
            console.log(updateBookQuantity)
            res.send(result)
        })

        // update Book 
        app.put('/update/:id', async (req, res) => {

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedBook = req.body;

            const book = {
                $set: {
                    book_image: updatedBook.book_image,
                    book_name: updatedBook.book_name,
                    book_quantity: updatedBook.book_quantity,
                    book_author: updatedBook.book_author,
                    book_category: updatedBook.book_category,
                    book_rating: updatedBook.book_rating,
                    book_description: updatedBook.book_description,
                    staticContent: updatedBook.staticContent,
                }
            }

            const result = await librarianCollection.updateOne(filter, book, options);
            res.send(result);
        })

        // Delete Book
        app.delete('/delete-books/:id', async (req, res) => {
            const id = req.params.id
            // console.log('Please delete', id)
            const query = { _id: new ObjectId(id) }
            const result = await librarianCollection.deleteOne(query)
            res.send(result)
        })

        // Delete Borrowed Book
        app.delete('/delete-borrowed-books/:id', async (req, res) => {
            const id = req.params.id
            // console.log('Please delete', id)
            const query = { borrow_id: id }
            const result = await borrowCollection.deleteOne(query)

            // update Book count in 
            const updateDoc = {
                $inc: { book_quantity: 1 },
            }
            const borrowQuery = { _id: new ObjectId(id) }
            const updateBookQuantity = await librarianCollection.updateOne(borrowQuery, updateDoc)
            console.log(updateBookQuantity)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})