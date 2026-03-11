import axios, { AxiosError } from "axios";

const endpointsUrl = "http://localhost:8000/api/";
const loginUrl = `${endpointsUrl}token/`;
const refreshUrl = `${endpointsUrl}token/refresh/`;
const logoutUrl = `${endpointsUrl}logout/`;
const authUrl = `${endpointsUrl}is_authenticated/`;
const createUrl = `${endpointsUrl}register/`;
const usersDetailUrl = `${endpointsUrl}details/`;
const topUpRFID = `${endpointsUrl}topup/`;
const addSchedulesUrl = `${endpointsUrl}schedules/`;
const bookSchedules = `${endpointsUrl}bookings/`;

export const login = async (
  username: string,
  password: string
): Promise<boolean> => {
  const res = await axios.post(
    loginUrl,
    { username, password },
    { withCredentials: true }
  );
  return res.data.success;
};

export const refresh_token = async (): Promise<boolean> => {
  try {
    const response = await axios.post(
      refreshUrl,
      {},
      { withCredentials: true }
    );

    if (response.data.access) {
      localStorage.setItem("access_token", response.data.access);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Refresh token failed:", error);
    return false;
  }
};

export const call_refresh = async <T,>(
  error: AxiosError,
  func: () => Promise<T>
): Promise<T | false> => {
  if (error.response?.status === 401) {
    const tokenRefreshed = await refresh_token();
    if (tokenRefreshed) {
      try {
        const retry = await func();
        return retry;
      } catch (retryError) {
        console.error("Retry after refresh failed:", retryError);
      }
    }
  }
  return false;
};

export const logout = async () => {
  try {
    await axios.post(logoutUrl, {}, { withCredentials: true });
    return true;
  } catch (error) {
    return false;
  }
};

export const is_authenticated = async () => {
  try {
    await axios.post(authUrl, {}, { withCredentials: true });
    return true;
  } catch (error) {
    return false;
  }
};

export const register = async (
  username: string,
  email: string,
  password: string
): Promise<boolean> => {
  try {
    const res = await axios.post(
      createUrl,
      { username, email, password },
      { withCredentials: true }
    );
    return true;
  } catch (error) {
    console.error("Register failed:", error);
    return false;
  }
};

export const bookings = async (
  rfid: string,
  origin: string,
  destination: string,
  departure: string,
  return_date: string,
  trip: string,
  seat_class: string,
  passenger: number,
  settled: number
): Promise<boolean> => {
  try {
    const rest = await axios.post(
      bookSchedules,
      {
        rfid,
        origin,
        destination,
        departure,
        return_date,
        trip,
        seat_class,
        passenger,
        settled,
      },
      { withCredentials: true }
    );
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Booking API failed:",
        error.response?.status,
        error.response?.data
      );
    } else {
      console.error("Booking API failed:", error);
    }
    return false;
  }
};

export const getAllBookings = async (): Promise<any[] | false> => {
  try {
    const res = await axios.get(bookSchedules, {
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    console.error("Fetching bookings failed:", error);
    return false;
  }
};

export const createSchedules = async (
  origin: string,
  destination: string,
  departure_date: string,
  return_date: string,
  price_economy_class: string,
  price_business_class: string
): Promise<boolean> => {
  try {
    const rest = await axios.post(
      addSchedulesUrl,
      {
        origin,
        destination,
        departure_date,
        return_date,
        price_economy_class,
        price_business_class,
      },
      { withCredentials: true }
    );
    return true;
  } catch (error) {
    return false;
  }
};

export const getSchedules = async (): Promise<any[] | false> => {
  try {
    const res = await axios.get(addSchedulesUrl, {
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("Get schedules failed:", axiosError);

    const retry = await call_refresh(axiosError, () =>
      axios.get(addSchedulesUrl, { withCredentials: true })
    );

    return retry ? (retry as any).data : false;
  }
};

export const usersDetails = async (
  fullname: string,
  role: string,
  birthdate: string,
  address: string,
  phone: BigInteger,
  rfid_number: string,
  date_rfid_create: string,
  expiry_rfid: string,
  rfid_balance: string,
  payment: string
): Promise<boolean> => {
  try {
    const res = await axios.post(
      usersDetailUrl,
      {
        fullname,
        role,
        birthdate,
        address,
        phone,
        rfid_number,
        date_rfid_create,
        expiry_rfid,
        rfid_balance,
        payment,
      },
      { withCredentials: true }
    );
    return true;
  } catch (error) {
    console.error("Register failed:", error);
    return false;
  }
};

export const getAllUsers = async (): Promise<any[] | false> => {
  try {
    const res = await axios.get(usersDetailUrl, {
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    console.error("Fetching all users failed:", error);
    return false;
  }
};

export const updateUserDetails = async (
  id: number,
  data: {
    fullname: string;
    role: string;
    birthdate: string;
    address: string;
    rfid_number: string;
    expiry_rfid: string;
    payment: string;
  }
): Promise<boolean> => {
  try {
    const res = await axios.put(`${usersDetailUrl}${id}/`, data, {
      withCredentials: true,
    });
    return true;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("Update failed:", axiosError);

    // If token expired, retry
    const retry = await call_refresh(axiosError, () =>
      axios.put(`${usersDetailUrl}${id}/`, data, { withCredentials: true })
    );
    return !!retry;
  }
};

export const deleteUserDetails = async (id: number): Promise<boolean> => {
  try {
    await axios.delete(`${usersDetailUrl}${id}/`, { withCredentials: true });
    return true;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("Delete failed:", axiosError);

    // Retry if token expired
    const retry = await call_refresh(axiosError, () =>
      axios.delete(`${usersDetailUrl}${id}/`, { withCredentials: true })
    );
    return !!retry;
  }
};

export const getUserDetailsByRFID = async (
  rfid_number: string
): Promise<any | false> => {
  try {
    const res = await axios.get(usersDetailUrl, {
      params: { rfid_number },
      withCredentials: true,
    });

    if (res.data && res.data.rfid_number) {
      return res.data;
    }

    return false;
  } catch (error) {
    console.error("Get user by RFID failed:", error);
    return false;
  }
};

export const updateRFIDBalance = async (
  rfid_number: string,
  topupAmount: number
): Promise<boolean> => {
  try {
    const res = await axios.post(
      topUpRFID,
      {
        rfid_number,
        topup_amount: topupAmount,
      },
      { withCredentials: true }
    );

    return res.status === 200;
  } catch (error) {
    console.error("Top-up failed:", error);
    return false;
  }
};
