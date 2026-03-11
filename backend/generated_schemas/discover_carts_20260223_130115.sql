CREATE TABLE Products (
    ProductID SERIAL PRIMARY KEY,
    ProductName VARCHAR(255) NOT NULL,
    ProductType VARCHAR(255) NOT NULL,
    Price DECIMAL(10, 2) NOT NULL,
    Description TEXT
);

CREATE TABLE AffiliateLinks (
    AffiliateLinkID SERIAL PRIMARY KEY,
    ProductID INT NOT NULL,
    AffiliateURL VARCHAR(255) NOT NULL,
    FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
);