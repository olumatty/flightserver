const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());

// API Route to Get Flight Prices
app.post("/get-flight-prices", async (req, res) => {
    try {
        const { departure_location, destination, departure_date, flight_type, number_of_passengers } = req.body;

        const response = await axios.get("https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights", {
            params: {
                fromId: `${departure_location}.AIRPORT`,
                toId: `${destination}.AIRPORT`,
                departDate: departure_date,
                adults: number_of_passengers,
                children: "0",
                travelClass: flight_type
            },
            headers: {
                "x-rapidapi-host": "booking-com15.p.rapidapi.com",
                "x-rapidapi-key": process.env.BOOKING_COM_API_KEY,
            }
        });

        // Extract flights from the API response
        const flights = response.data.data.flightOffers || [];
        
        // Map the flights to our desired structure
        const structuredFlights = flights.map(flight => {
            // Initialize a flight data object with default values
            const flightData = {
                airline: "Unknown",
                price: "N/A",
                currency: "USD",
                departureTime: "N/A",
                arrivalTime: "N/A",
                duration: "N/A",
                stops: 0,
                flightNumber: "N/A"
            };
            
            // Extract flight information
            if (flight.segments && flight.segments.length > 0) {
                // Extract airline information from first segment
                const firstSegment = flight.segments[0];
                if (firstSegment.marketingCarrier) {
                    flightData.airline = firstSegment.marketingCarrier.name || "Unknown";
                }
                
                // Extract flight number
                flightData.flightNumber = firstSegment.marketingCarrier?.code + firstSegment.marketingCarrier?.number || "N/A";
                
                // Extract departure time
                if (firstSegment.departure) {
                    flightData.departureTime = firstSegment.departure.localDateTime || "N/A";
                }
                
                // Extract arrival time from last segment
                const lastSegment = flight.segments[flight.segments.length - 1];
                if (lastSegment.arrival) {
                    flightData.arrivalTime = lastSegment.arrival.localDateTime || "N/A";
                }
                
                // Calculate stops
                flightData.stops = flight.segments.length - 1;
                
                // Extract duration
                if (flight.totalDuration) {
                    flightData.duration = flight.totalDuration;
                }
            }
            
            // Extract price information
            if (flight.totalPrice) {
                flightData.price = `${flight.totalPrice.units}.${flight.totalPrice.nanos / 10000000}`;
                flightData.currency = flight.totalPrice.currencyCode || "USD";
            } else if (flight.priceBreakdown && flight.priceBreakdown.total) {
                flightData.price = `${flight.priceBreakdown.total.units}.${flight.priceBreakdown.total.nanos / 10000000}`;
                flightData.currency = flight.priceBreakdown.total.currencyCode || "USD";
            }
            
            return flightData;
        });

        res.status(200).json({
            agent: "Alice", 
            extractedInfo: {
                departure_location, 
                destination, 
                departure_date, 
                flight_type, 
                number_of_passengers 
            }, 
            flights: structuredFlights
        });
    } catch (error) {
        console.error("Error fetching flight prices:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch flight prices", details: error.message });
    }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
    console.log(`Alice's Flight Agent is running on port ${PORT}`);
});