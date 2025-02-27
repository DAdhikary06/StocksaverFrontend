import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AuthHandler from "../utils/Authhandler";
import APIHandler from "../utils/APIHandler";
import { toast } from "react-hot-toast";
import Pagination from "../utils/Pagination";
import usePagination from "../Hooks/usePagination";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement } from '@stripe/react-stripe-js';
import { useStripe, useElements } from '@stripe/react-stripe-js';


const stripePromise = loadStripe("pk_test_51QiiAPJKxBLf3nf78m8x5jLkWY6cG8inIqvXD1EFxkEcSBo8lW7oUGEBmgPm7LkS0EerzszPCx2xl1JpiUkXYx6M00EAJjJ6Mx");

const CheckoutForm = ({ clientSecret, onSuccess, amount, companyId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to get the company name from companyData by companyId
  // const getCompanyName = (companyId) => {
  //   const selectedCompany = companyData.find(company => company.id === companyId);
  //   console.log('Company data:', companyData);
  //   console.log('Selected company:', selectedCompany.name);
  //   return selectedCompany ? selectedCompany.name : 'Company Account Payment'; // Default name if not found
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // const companyName = getCompanyName(companyId); // Dynamically get company name
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: 'Test User' // Set the dynamic company name in billing details
          },
        },
      });
      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        await onSuccess(paymentIntent);
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      toast.error('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <CardElement
        options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': {
                color: '#aab7c4',
              },
            },
            invalid: {
              color: '#9e2146',
            },
          },
        }}
      />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="pay-button"
      >
        {loading ? 'Processing...' : `Pay ₹${amount}`}
      </button>
      {error && <div className="error-message">{error}</div>}
    </form>
  );
};

const CompanyAccount = () => {

  const { id } = useParams();
  const apiHandler = APIHandler();
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    company_id: "",
    // transaction_type: "",
    transaction_amt: "",
    // transaction_date: "",
    // payment_mode: "",
  });

  const [companyAccountData, setCompanyAccountData] = useState([]);
  const [companyList, setCompanyData] = useState([]);
  const [clientSecret, setClientSecret] = useState("");

//---------------------- Fetch Company Account Data ----------------------//

  useEffect(() => {
    AuthHandler.checkTokenExpiry();
    fetchCompanyAccountData();
  }, [id]);

  const fetchCompanyAccountData = async () => {
    const companyData = await apiHandler.fetchCompanyOnly();
    console.log("Company Data", companyData.data);
    setCompanyData(companyData.data);
    updateDataAgain();
  };

//---------------------- Update Company Account Data ----------------------//

  const updateDataAgain = async () => {
    const companyAccountData = await apiHandler.fetchAllCompanyAccount();
    console.log("Company Account Data", companyAccountData.data.data);
    setCompanyAccountData(companyAccountData.data.data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handlePayment = async (e) => {
    e.preventDefault();

    if (!formData.transaction_amt || !formData.company_id) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const amountInPaise = Math.round(formData.transaction_amt * 100);
      
      const response = await apiHandler.createPaymentIntent({
        amount: amountInPaise,
        company_id: formData.company_id,
        currency: 'inr'
      });
      if (response.clientSecret) {
        setClientSecret(response.clientSecret);
      } else {
        throw new Error('No client secret received');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to initialize payment');
    }
  };

  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      await apiHandler.handlePaymentSuccess({
        paymentIntentId: paymentIntent.id,
        companyId: formData.company_id,
        amount: formData.transaction_amt
      });

      toast.success("Payment successful!");
      setClientSecret(null);
      updateDataAgain();
    } catch (error) {
      toast.error("Error processing payment");
    }
  };



    // try {
    //   const response = await apiHandler.saveCompanyTransactionData(
    //     formData.company_id,
    //     formData.transaction_type,
    //     formData.transaction_amt,
    //     formData.transaction_date,
    //     formData.payment_mode
    //   );
    //   console.log("Company Account Transaction", response.data);

    //   // Check for error in the response
    //   if (response.data.error) {
    //     console.log(
    //       "Error saving company transaction data:",
    //       response.data.error
    //     ); // Use response.data.error
    //     toast.error(response.data.message);
    //     return false;
    //   } else {
    //     toast.success(response.data.message);
    //     // Reset form fields
    //     setFormData({
    //       company_id: "",
    //       transaction_type: "",
    //       transaction_amt: "",
    //       transaction_date: "",
    //       payment_mode: "",
    //     });
    //   }

    //   // Fetch updated company data

    //   fetchCompanyAccountData();
    // } catch (error) {
    //   console.error("Error saving company data:", error);
    //   toast.error("Error saving company data");
    // }


//  ---------------------- Search ---------------------- //

  const filteredCompanyAccountData = companyAccountData.filter((company) => {
    return (
      company.company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.transaction_type.toString().includes(searchQuery) ||
      company.transaction_amt.toString().includes(searchQuery) ||
      company.transaction_date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.payment_mode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

 //  ---------------------- Pagination ---------------------- //

  const itemsPerPage = 5;
  const {
    currentPage,
    currentData: currentAccountData,
    totalPages,
    handlePageChange,
  } = usePagination(filteredCompanyAccountData, itemsPerPage);

  return (
    <div className="container-fluid p-0">
      <div className="row mb-2 mb-xl-3">
        <h3 className="mb-3">
          <strong>Manage Company Account</strong> Details
        </h3>
        <div className="col-md-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Add Company Account Bill </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handlePayment}>
                <div className="row">
                  <div className="mb-3 col-md-6">
                    <label className="form-label" htmlFor="company">
                      Company
                    </label>
                    <select
                      className="form-select"
                      name="company_id"
                      id="company_id"
                      value={formData.company_id}
                      onChange={handleChange}
                    >
                      <option value="">Select Company</option>
                      {companyList.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* <div className="mb-3 col-md-6">
                    <label className="form-label" htmlFor="transaction_type">
                      Transaction Type
                    </label>
                    <select
                      className="form-select"
                      id="transaction_type"
                      name="transaction_type"
                      value={formData.transaction_type}
                      onChange={handleChange}
                    >
                      <option value="">Select Transaction Type</option>
                      <option value="1">Debit</option>
                      <option value="2">Credit</option>
                    </select>
                  </div> */}
                  <div className="mb-3 col-md-6">
                    <label className="form-label" htmlFor="amount">
                      Amount(INR)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="transaction_amt"
                      name="transaction_amt"
                      placeholder="Enter Amount"
                      value={formData.transaction_amt}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {/* <div className="mb-3 col-md-6">
                    <label className="form-label" htmlFor="transaction_date">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="transaction_date"
                      name="transaction_date"
                      placeholder="Enter Transaction Date"
                      value={formData.transaction_date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="mb-3 col-md-6">
                    <label className="form-label" htmlFor="payment_mode">
                      Payment Mode
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="payment_mode"
                      name="payment_mode"
                      placeholder="Enter Payment Mode"
                      value={formData.payment_mode}
                      onChange={handleChange}
                      required
                    />
                  </div> */}
                </div>
                <button type="submit" className="btn btn-primary">
                  Add Company Payment
                </button>
              </form>
              {clientSecret && (
                <Elements stripe={stripePromise}>
                  <CheckoutForm
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    amount={formData.transaction_amt}
                    companyId={formData.company_id}
                  />
                </Elements>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-12 mt-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">All Company Account Transactions</h3>
            </div>
            <div className="card-body">
              <div className="row mb-2">
                <div className="col-sm-12 ml-2">
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search company transactions.."
                  />
                </div>
              </div>
              
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      {/* <th>ID</th> */}
                      <th>Company Name</th>
                      <th>Company ID</th>
                      <th>Transaction Type</th>
                      <th>Amount</th>
                      <th>Transaction Date</th>
                      <th>Payment Mode</th>
                      <th>Added on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Display Company Account Data */}
                    {currentAccountData.length > 0 ? (
                      currentAccountData.map((companyaccount, index) => (
                        <tr key={index}>
                          {/* <td>{companyaccount.id}</td> */}
                          <td>{companyaccount.company.name}</td>
                          <td>{companyaccount.company.id}</td>
                          <td
                            className={
                              companyaccount.transaction_type == 1
                                ? "text-danger"
                                : "text-success"
                            }
                          >
                            {companyaccount.transaction_type == 1
                              ? "Debit"
                              : "Credit"}
                          </td>
                          <td
                            className={
                              companyaccount.transaction_type == 1
                                ? "text-danger"
                                : "text-success"
                            }
                          >
                            {companyaccount.transaction_type == 1
                              ? `-${companyaccount.transaction_amt}`
                              : `+${companyaccount.transaction_amt}`}
                          </td>
                          <td>{companyaccount.transaction_date}</td>
                          <td>{companyaccount.payment_mode}</td>
                          <td>
                            {new Date(companyaccount.added_on).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="text-center">
                          No record found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyAccount;
