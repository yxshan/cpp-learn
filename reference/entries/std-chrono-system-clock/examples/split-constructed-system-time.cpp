#include <chrono>
#include <iostream>

int main() {
    using namespace std::chrono;
    const sys_days day_point{year{2024} / February / day{29}};
    const auto value = day_point + hours{12} + minutes{34} + seconds{56};
    const auto whole_days = floor<days>(value);
    const year_month_day date{whole_days};
    const hh_mm_ss time{value - whole_days};

    std::cout << "date=" << static_cast<int>(date.year()) << '-'
              << static_cast<unsigned>(date.month()) << '-'
              << static_cast<unsigned>(date.day()) << '\n';
    std::cout << "time=" << time.hours().count() << ':'
              << time.minutes().count() << ':' << time.seconds().count() << '\n';
}
