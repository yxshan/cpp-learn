#include <forward_list>
#include <iostream>
#include <iterator>

void print_values(const char* label, const std::forward_list<int>& values) {
    std::cout << label << '=';
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}

int main() {
    std::forward_list<int> source{1, 2, 3};
    std::forward_list<int> target{10, 20};
    const auto before_two = source.begin();
    const auto moved = std::next(before_two);
    target.splice_after(target.before_begin(), source, before_two);

    std::cout << "moved=" << *moved << '\n';
    print_values("source", source);
    print_values("target", target);
}
