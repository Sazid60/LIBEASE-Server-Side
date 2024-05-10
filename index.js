const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjbmdks.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Collection-1
        // const allBookCollection = client.db('bookDB').collection('books')
        const librarianCollection = client.db('librarianDB').collection('librarianBooks')

        // Get All Added Data
        app.get('/all-books', async (req, res) => {
            const cursor = librarianCollection.find();
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

        // Add Craft & Art
        app.post('/add-book', async (req, res) => {
            const newBook = req.body;
            console.log(newBook)
            const result = await librarianCollection.insertOne(newBook);
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

        app.delete('/delete-books/:id', async (req, res) => {
            const id = req.params.id
            console.log('Please delete', id)
            const query = { _id: new ObjectId(id) }
            const result = await librarianCollection.deleteOne(query)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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