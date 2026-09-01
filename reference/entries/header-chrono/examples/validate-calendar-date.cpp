#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    const year_month_day date{year{2024}, February, day{29}};
    const weekday weekday_value{sys_days{date}};

    std::cout << std::boolalpha << "valid=" << date.ok() << '\n';
    std::cout << "weekday_iso=" << weekday_value.iso_encoding() << '\n';
}
