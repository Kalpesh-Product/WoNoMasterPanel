import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PageFrame from "../../../components/Pages/PageFrame";
import AgTable from "../../../components/AgTable";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const VisaCountries = () => {
  const axiosPrivate = useAxiosPrivate();

  const {
    data: countries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["visaCountriesList"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "/api/visa-rules/destinations/countries",
      );
      return response?.data?.countries || [];
    },
  });

  const tableRows = useMemo(
    () =>
      countries.map((country, index) => ({
        id: `${country}-${index}`,
        srNo: index + 1,
        country,
      })),
    [countries],
  );

  const columns = useMemo(
    () => [
      {
        field: "srNo",
        headerName: "Sr No",
        width: 110,
      },
      {
        field: "country",
        headerName: "Country",
        flex: 1,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={params?.data?.id}
            menuItems={[
              {
                label: "Visa Details",
                onClick: () => {},
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  if (isError) {
    return (
      <div className="p-6 text-red-500">Failed to load visa countries.</div>
    );
  }

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={tableRows}
          columns={columns}
          search={true}
          tableTitle="Visa Countries"
          tableHeight={500}
          loading={isLoading}
        />
      </PageFrame>
    </div>
  );
};

export default VisaCountries;
