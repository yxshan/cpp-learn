#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view record{"alice:admin"};
    const std::size_t separator = record.find(':');

    const std::string_view name = record.substr(0, separator);
    const std::string_view role = record.substr(separator + 1);
    std::cout << name << ' ' << role << '\n';
}
