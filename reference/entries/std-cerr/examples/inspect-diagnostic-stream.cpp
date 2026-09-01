#include <iostream>

int main() {
    const bool has_unitbuf =
        (std::cerr.flags() & std::ios_base::unitbuf) != 0;

    std::cout << std::boolalpha << "unitbuf=" << has_unitbuf << '\n';
    std::cout << "tied_to_cout=" << (std::cerr.tie() == &std::cout) << '\n';
}
